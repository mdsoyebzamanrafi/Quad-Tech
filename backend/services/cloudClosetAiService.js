const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_VISION_MODEL = 'gemini-2.5-flash';
const GEMINI_FALLBACK_VISION_MODELS = ['gemini-2.0-flash'];
const MAX_RAW_TEXT_LENGTH = 6000;
const MAX_KEYWORDS = 20;

const logCloudCloset = (...args) => {
    if (process.env.NODE_ENV !== 'test') {
        console.log('[Cloud Closet]', ...args);
    }
};

const logCloudClosetError = (...args) => {
    if (process.env.NODE_ENV !== 'test') {
        console.error('[Cloud Closet]', ...args);
    }
};

const emptyAttributes = {
    department: null,
    category: null,
    productType: null,
    gender: null,
    colors: [],
    sizes: [],
    material: null,
    fit: null,
    occasion: null,
    season: null,
    styleTags: [],
    keywords: [],
    confidence: 0,
};

const truncateText = (value, limit = MAX_RAW_TEXT_LENGTH) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    return text.length > limit ? `${text.slice(0, limit)}...` : text;
};

const buildCanonicalLookup = (values = []) => {
    const lookup = new Map();

    (Array.isArray(values) ? values : []).forEach((value) => {
        if (typeof value !== 'string') {
            return;
        }

        const trimmedValue = value.trim();
        if (!trimmedValue) {
            return;
        }

        lookup.set(trimmedValue.toLowerCase(), trimmedValue);
    });

    return lookup;
};

const canonicalizeScalar = (value, validValues = []) => {
    if (typeof value !== 'string') {
        return null;
    }

    const lookup = buildCanonicalLookup(validValues);
    return lookup.get(value.trim().toLowerCase()) || null;
};

const canonicalizeArray = (values, validValues = []) => {
    const lookup = buildCanonicalLookup(validValues);
    const seenValues = new Set();

    return (Array.isArray(values) ? values : [])
        .filter((value) => typeof value === 'string')
        .map((value) => lookup.get(value.trim().toLowerCase()))
        .filter(Boolean)
        .filter((value) => {
            const key = value.toLowerCase();
            if (seenValues.has(key)) {
                return false;
            }
            seenValues.add(key);
            return true;
        });
};

const normalizeKeywords = (keywords) => {
    const rawKeywords = Array.isArray(keywords)
        ? keywords
        : typeof keywords === 'string'
            ? [keywords]
            : [];
    const seenKeywords = new Set();

    return rawKeywords
        .filter((keyword) => typeof keyword === 'string')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .map((keyword) => keyword.slice(0, 60))
        .filter((keyword) => {
            const key = keyword.toLowerCase();
            if (seenKeywords.has(key)) {
                return false;
            }
            seenKeywords.add(key);
            return true;
        })
        .slice(0, MAX_KEYWORDS);
};

const normalizeConfidence = (confidence) => {
    const numericConfidence = Number(confidence);
    if (!Number.isFinite(numericConfidence)) {
        return 0;
    }

    return Math.min(1, Math.max(0, numericConfidence));
};

const validateCloudClosetAttributes = (rawAttributes = {}, validValues = {}) => {
    const validatedAttributes = {
        ...emptyAttributes,
        category: canonicalizeScalar(rawAttributes.category, validValues.categories),
        productType: canonicalizeScalar(rawAttributes.productType, validValues.productTypes),
        gender: canonicalizeScalar(rawAttributes.gender, validValues.genders),
        colors: canonicalizeArray(rawAttributes.colors, validValues.colors),
        sizes: canonicalizeArray(rawAttributes.sizes, validValues.sizes),
        material: canonicalizeScalar(rawAttributes.material, validValues.materials),
        fit: canonicalizeScalar(rawAttributes.fit, validValues.fits),
        occasion: canonicalizeScalar(rawAttributes.occasion, validValues.occasions),
        season: canonicalizeScalar(rawAttributes.season, validValues.seasons),
        styleTags: canonicalizeArray(rawAttributes.styleTags, validValues.styleTags),
        keywords: normalizeKeywords(rawAttributes.keywords),
        confidence: normalizeConfidence(rawAttributes.confidence),
    };

    const department = canonicalizeScalar(rawAttributes.department, validValues.departments);
    validatedAttributes.department = department?.toLowerCase() === 'fashion' ? department : null;

    return validatedAttributes;
};

const stripMarkdownFences = (text) =>
    String(text || '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

const extractFirstJsonObject = (text) => {
    const cleanedText = stripMarkdownFences(text);
    const firstBraceIndex = cleanedText.indexOf('{');

    if (firstBraceIndex === -1) {
        throw new Error('Gemini response did not include a JSON object.');
    }

    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let index = firstBraceIndex; index < cleanedText.length; index += 1) {
        const character = cleanedText[index];

        if (isEscaped) {
            isEscaped = false;
            continue;
        }

        if (character === '\\') {
            isEscaped = true;
            continue;
        }

        if (character === '"') {
            inString = !inString;
            continue;
        }

        if (inString) {
            continue;
        }

        if (character === '{') {
            depth += 1;
        }

        if (character === '}') {
            depth -= 1;
            if (depth === 0) {
                return cleanedText.slice(firstBraceIndex, index + 1);
            }
        }
    }

    throw new Error('Gemini response JSON object was incomplete.');
};

const parseGeminiJsonResponse = (text) => {
    const jsonText = extractFirstJsonObject(text);
    return JSON.parse(jsonText);
};

const buildGeminiPrompt = (validValues) => `You are analyzing a user's clothing image for an ecommerce recommendation system.

Return ONLY valid JSON.
No markdown.
No explanation.

Use this schema:
{
  "department": null,
  "category": null,
  "productType": null,
  "gender": null,
  "colors": [],
  "sizes": [],
  "material": null,
  "fit": null,
  "occasion": null,
  "season": null,
  "styleTags": [],
  "keywords": [],
  "confidence": 0
}

Valid values:
${JSON.stringify(validValues)}

Rules:
- Analyze only the visible clothing/fashion item.
- Use only values from valid values when possible.
- If unsure, use null or [].
- Do not invent brand names.
- Do not identify a real person.
- Do not describe the background.
- department should usually be "fashion" if this is clothing.
- category should be the product family, for example Dresses, Shirts, Shoes, Bags, Pants.
- productType should be normalized, for example dress, shirt, sneaker, hoodie, jeans.
- colors should be visible colors from the image.
- material should only be filled if visually likely.
- season, occasion, and styleTags should be inferred conservatively.
- keywords should be short useful search and ranking terms.
- confidence must be 0 to 1.
- If image does not contain a clothing/fashion item, return:
  {
    "department": null,
    "category": null,
    "productType": null,
    "gender": null,
    "colors": [],
    "sizes": [],
    "material": null,
    "fit": null,
    "occasion": null,
    "season": null,
    "styleTags": [],
    "keywords": [],
    "confidence": 0
  }`;

const extractGeminiText = (responseBody) => {
    const parts = responseBody?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
        ? parts
            .map((part) => (typeof part.text === 'string' ? part.text : ''))
            .filter(Boolean)
            .join('\n')
        : '';

    if (!text) {
        throw new Error('Gemini response did not include analyzable text.');
    }

    return text;
};

const normalizeGeminiModelName = (model) => String(model || '').trim().replace(/^models\//, '');

const getGeminiVisionModels = () => {
    const configuredModels = String(process.env.GEMINI_VISION_MODEL || '')
        .split(',')
        .map(normalizeGeminiModelName)
        .filter(Boolean);

    return Array.from(new Set([
        ...configuredModels,
        DEFAULT_GEMINI_VISION_MODEL,
        ...GEMINI_FALLBACK_VISION_MODELS,
    ]));
};

const getGeminiVisionModel = () => getGeminiVisionModels()[0] || DEFAULT_GEMINI_VISION_MODEL;

const buildGeminiGenerateContentUrl = (model) => {
    const normalizedModel = normalizeGeminiModelName(model);
    return `${GEMINI_API_BASE_URL}/models/${normalizedModel}:generateContent?key=${process.env.GEMINI_API_KEY}`;
};

const loadImageBufferFromUrl = async (imageUrl) => {
    logCloudCloset('Downloading image for Gemini reanalysis', { imageUrl });
    const response = await fetch(imageUrl);

    if (!response.ok) {
        throw new Error('Could not download Cloud Closet image for analysis.');
    }

    return {
        imageBuffer: Buffer.from(await response.arrayBuffer()),
        mimeType: response.headers.get('content-type') || '',
    };
};

const requestGeminiAnalysis = async ({ aiModel, analysisImageBuffer, analysisMimeType, validValues }) => {
    const geminiPrompt = buildGeminiPrompt(validValues);
    const url = buildGeminiGenerateContentUrl(aiModel);
    logCloudCloset('Gemini analysis starting', {
        aiModel,
        mimeType: analysisMimeType,
        imageBytes: analysisImageBuffer.length,
    });
    logCloudCloset('Gemini prompt follows:\n', geminiPrompt);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: geminiPrompt },
                        {
                            inline_data: {
                                mime_type: analysisMimeType,
                                data: analysisImageBuffer.toString('base64'),
                            },
                        },
                    ],
                },
            ],
            generationConfig: {
                temperature: 0.1,
                response_mime_type: 'application/json',
            },
        }),
    });

    const responseText = await response.text();
    logCloudCloset('Gemini HTTP response received', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        responseBytes: responseText.length,
    });
    logCloudCloset('Gemini raw response follows:\n', responseText);

    let responseBody = null;

    try {
        responseBody = responseText ? JSON.parse(responseText) : null;
    } catch (error) {
        logCloudClosetError('Gemini HTTP response was not valid JSON', {
            message: error.message,
        });
        responseBody = null;
    }

    if (!response.ok) {
        const error = new Error(`Gemini Vision analysis failed with status ${response.status}.`);
        error.rawAiResponse = { text: truncateText(responseText) };
        logCloudClosetError('Gemini analysis failed before parsing candidate text', {
            message: error.message,
        });
        throw error;
    }

    let geminiText = '';
    try {
        geminiText = extractGeminiText(responseBody);
        logCloudCloset('Gemini candidate text follows:\n', geminiText);
        const rawAttributes = parseGeminiJsonResponse(geminiText);
        logCloudCloset('Gemini parsed attributes', rawAttributes);
        const attributes = validateCloudClosetAttributes(rawAttributes, validValues);
        logCloudCloset('Gemini validated attributes', attributes);

        return {
            aiModel,
            attributes,
            rawAiResponse: {
                text: truncateText(geminiText),
                parsed: rawAttributes,
            },
        };
    } catch (error) {
        error.rawAiResponse = {
            text: truncateText(geminiText || responseText),
        };
        logCloudClosetError('Gemini response parsing or validation failed', {
            message: error.message,
        });
        throw error;
    }
};

const analyzeCloudClosetImage = async ({ imageBuffer, imageUrl, mimeType, validValues }) => {
    if (!process.env.GEMINI_API_KEY) {
        logCloudClosetError('Gemini API key is missing before analysis call');
        throw new Error('Gemini API key is missing.');
    }

    let analysisImageBuffer = imageBuffer;
    let analysisMimeType = mimeType;

    if (!analysisImageBuffer && imageUrl) {
        const downloadedImage = await loadImageBufferFromUrl(imageUrl);
        analysisImageBuffer = downloadedImage.imageBuffer;
        analysisMimeType = analysisMimeType || downloadedImage.mimeType;
    }

    if (!analysisImageBuffer || !analysisMimeType) {
        logCloudClosetError('Gemini analysis missing image data', {
            hasImageBuffer: Boolean(analysisImageBuffer),
            mimeType: analysisMimeType,
        });
        throw new Error('Image data is required for Gemini analysis.');
    }

    const modelsToTry = getGeminiVisionModels();
    let lastError = null;

    for (const aiModel of modelsToTry) {
        try {
            return await requestGeminiAnalysis({
                aiModel,
                analysisImageBuffer,
                analysisMimeType,
                validValues,
            });
        } catch (error) {
            lastError = error;
            logCloudClosetError('Gemini model attempt failed', {
                aiModel,
                message: error.message,
                rawAiResponse: error.rawAiResponse,
            });
        }
    }

    throw lastError || new Error('Gemini Vision analysis failed.');
};

export {
    analyzeCloudClosetImage,
    emptyAttributes,
    getGeminiVisionModel,
    getGeminiVisionModels,
    parseGeminiJsonResponse,
    validateCloudClosetAttributes,
};
