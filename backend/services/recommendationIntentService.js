import Product from '../models/Product.js';

const DEFAULT_INTENT = Object.freeze({
    department: null,
    category: null,
    productType: null,
    brand: null,
    gender: null,
    minPrice: null,
    maxPrice: null,
    requestedColors: [],
    requestedSizes: [],
    requestedMaterials: [],
    fit: null,
    occasion: null,
    season: null,
    styleTags: [],
    sortBy: 'recommended',
    confidence: 0,
});

const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_OLLAMA_MODEL = 'llama3.1';
const DEFAULT_OLLAMA_TIMEOUT_MS = 30000;
const ALLOWED_SORT_VALUES = new Set(['recommended', 'price_low', 'price_high', 'rating', 'newest']);
const INTENT_WRAPPER_KEYS = ['$set', 'intent', 'filters', 'filter', 'query'];

const shouldLogOllamaDebug = () =>
    process.env.OLLAMA_DEBUG === 'true' ||
    (process.env.OLLAMA_DEBUG !== 'false' && process.env.NODE_ENV !== 'production');

const logOllamaDebug = (...args) => {
    if (shouldLogOllamaDebug()) {
        console.log(...args);
    }
};

const flattenValues = (values) =>
    values.flatMap((value) => {
        if (Array.isArray(value)) {
            return flattenValues(value);
        }

        return [value];
    });

const cleanDistinctValues = (values) =>
    Array.from(
        new Set(
            flattenValues(values)
                .filter((value) => typeof value === 'string')
                .map((value) => value.trim())
                .filter(Boolean)
        )
    ).sort((first, second) => first.localeCompare(second));

const normalizeComparable = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const compactComparable = (value) => normalizeComparable(value).replace(/\s+/g, '');

const singularizeWord = (value) => {
    if (value.endsWith('ies') && value.length > 3) {
        return `${value.slice(0, -3)}y`;
    }

    if (value.endsWith('sses') && value.length > 4) {
        return value.slice(0, -2);
    }

    if (value.endsWith('ses') && value.length > 3) {
        return value.slice(0, -2);
    }

    if (value.endsWith('s') && value.length > 3) {
        return value.slice(0, -1);
    }

    return value;
};

const singularizePhrase = (value) =>
    normalizeComparable(value)
        .split(' ')
        .map(singularizeWord)
        .join(' ');

const splitPromptTokens = (prompt) =>
    normalizeComparable(prompt)
        .split(' ')
        .filter((token) => token.length > 1);

const getCanonicalValue = (value, validValues) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = normalizeComparable(value);
    const compactValue = compactComparable(value);
    const singularValue = singularizePhrase(value);

    return (
        validValues.find((candidate) => {
            const normalizedCandidate = normalizeComparable(candidate);

            return (
                normalizedCandidate === normalizedValue ||
                compactComparable(candidate) === compactValue ||
                singularizePhrase(candidate) === singularValue
            );
        }) || null
    );
};

const findPromptMatch = (prompt, validValues, { allowPartialToken = false } = {}) => {
    const promptComparable = normalizeComparable(prompt);
    const compactPrompt = compactComparable(prompt);
    const singularPromptTokens = new Set(splitPromptTokens(prompt).map(singularizeWord));

    return (
        validValues.find((candidate) => {
            const candidateComparable = normalizeComparable(candidate);
            const candidateSingular = singularizePhrase(candidate);

            if (
                promptComparable.includes(candidateComparable) ||
                compactPrompt.includes(compactComparable(candidate)) ||
                promptComparable.includes(candidateSingular)
            ) {
                return true;
            }

            if (!allowPartialToken) {
                return false;
            }

            return candidateSingular
                .split(' ')
                .some((token) => singularPromptTokens.has(token));
        }) || null
    );
};

const findPromptMatches = (prompt, validValues, { allowPartialToken = false } = {}) => {
    const promptComparable = normalizeComparable(prompt);
    const compactPrompt = compactComparable(prompt);
    const singularPromptTokens = new Set(splitPromptTokens(prompt).map(singularizeWord));

    return validValues.filter((candidate) => {
        const candidateComparable = normalizeComparable(candidate);
        const candidateSingular = singularizePhrase(candidate);

        if (
            promptComparable.includes(candidateComparable) ||
            compactPrompt.includes(compactComparable(candidate)) ||
            promptComparable.includes(candidateSingular)
        ) {
            return true;
        }

        if (!allowPartialToken) {
            return false;
        }

        return candidateSingular
            .split(' ')
            .some((token) => singularPromptTokens.has(token));
    });
};

const normalizePositiveNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const cleanedValue =
        typeof value === 'string'
            ? value.replace(/,/g, '').replace(/[^0-9.]/g, '')
            : value;
    const numberValue = Number(cleanedValue);

    if (!Number.isFinite(numberValue) || numberValue < 0) {
        return null;
    }

    return numberValue;
};

const normalizeCanonicalList = (values, validValues) => {
    const rawValues = Array.isArray(values) ? values : typeof values === 'string' ? [values] : [];
    const seenValues = new Set();

    return rawValues.reduce((normalizedValues, value) => {
        const canonicalValue = getCanonicalValue(value, validValues);

        if (canonicalValue && !seenValues.has(canonicalValue)) {
            seenValues.add(canonicalValue);
            normalizedValues.push(canonicalValue);
        }

        return normalizedValues;
    }, []);
};

const unwrapIntentPayload = (rawIntent) => {
    let sourceIntent = rawIntent && typeof rawIntent === 'object' && !Array.isArray(rawIntent) ? rawIntent : {};

    for (const wrapperKey of INTENT_WRAPPER_KEYS) {
        if (
            sourceIntent[wrapperKey] &&
            typeof sourceIntent[wrapperKey] === 'object' &&
            !Array.isArray(sourceIntent[wrapperKey])
        ) {
            sourceIntent = sourceIntent[wrapperKey];
            break;
        }
    }

    return sourceIntent;
};

const validateIntent = (rawIntent, validValues) => {
    const sourceIntent = unwrapIntentPayload(rawIntent);
    const minPrice = normalizePositiveNumber(sourceIntent.minPrice);
    const maxPrice = normalizePositiveNumber(sourceIntent.maxPrice);
    let normalizedMinPrice = minPrice;
    let normalizedMaxPrice = maxPrice;

    if (normalizedMinPrice !== null && normalizedMaxPrice !== null && normalizedMinPrice > normalizedMaxPrice) {
        normalizedMinPrice = maxPrice;
        normalizedMaxPrice = minPrice;
    }

    const sortBy = ALLOWED_SORT_VALUES.has(sourceIntent.sortBy) ? sourceIntent.sortBy : 'recommended';
    const confidence = Math.min(Math.max(Number(sourceIntent.confidence) || 0, 0), 1);

    return {
        ...DEFAULT_INTENT,
        department: getCanonicalValue(sourceIntent.department, validValues.departments),
        category: getCanonicalValue(sourceIntent.category, validValues.categories),
        productType: getCanonicalValue(sourceIntent.productType, validValues.productTypes),
        brand: getCanonicalValue(sourceIntent.brand, validValues.brands),
        gender: getCanonicalValue(sourceIntent.gender, validValues.genders),
        minPrice: normalizedMinPrice,
        maxPrice: normalizedMaxPrice,
        requestedColors: normalizeCanonicalList(sourceIntent.requestedColors, validValues.colors),
        requestedSizes: normalizeCanonicalList(sourceIntent.requestedSizes, validValues.sizes),
        requestedMaterials: normalizeCanonicalList(sourceIntent.requestedMaterials, validValues.materials),
        fit: getCanonicalValue(sourceIntent.fit, validValues.fits),
        occasion: getCanonicalValue(sourceIntent.occasion, validValues.occasions),
        season: getCanonicalValue(sourceIntent.season, validValues.seasons),
        styleTags: normalizeCanonicalList(sourceIntent.styleTags, validValues.styleTags),
        sortBy,
        confidence,
    };
};

const hasMeaningfulIntent = (intent) =>
    Boolean(
        intent.department ||
            intent.category ||
            intent.productType ||
            intent.brand ||
            intent.gender ||
            intent.minPrice ||
            intent.maxPrice ||
            intent.requestedColors.length > 0 ||
            intent.requestedSizes.length > 0 ||
            intent.requestedMaterials.length > 0 ||
            intent.fit ||
            intent.occasion ||
            intent.season ||
            intent.styleTags.length > 0 ||
            intent.sortBy !== 'recommended'
    );

const mergeMissingIntentValues = (primaryIntent, fallbackIntent) => ({
    ...primaryIntent,
    department: primaryIntent.department || fallbackIntent.department,
    category: primaryIntent.category || fallbackIntent.category,
    productType: primaryIntent.productType || fallbackIntent.productType,
    brand: primaryIntent.brand || fallbackIntent.brand,
    gender: primaryIntent.gender || fallbackIntent.gender,
    minPrice: primaryIntent.minPrice ?? fallbackIntent.minPrice,
    maxPrice: primaryIntent.maxPrice ?? fallbackIntent.maxPrice,
    requestedColors: primaryIntent.requestedColors.length > 0
        ? primaryIntent.requestedColors
        : fallbackIntent.requestedColors,
    requestedSizes: primaryIntent.requestedSizes.length > 0
        ? primaryIntent.requestedSizes
        : fallbackIntent.requestedSizes,
    requestedMaterials: primaryIntent.requestedMaterials.length > 0
        ? primaryIntent.requestedMaterials
        : fallbackIntent.requestedMaterials,
    fit: primaryIntent.fit || fallbackIntent.fit,
    occasion: primaryIntent.occasion || fallbackIntent.occasion,
    season: primaryIntent.season || fallbackIntent.season,
    styleTags: primaryIntent.styleTags.length > 0 ? primaryIntent.styleTags : fallbackIntent.styleTags,
    sortBy: primaryIntent.sortBy !== 'recommended' ? primaryIntent.sortBy : fallbackIntent.sortBy,
    confidence: Math.max(primaryIntent.confidence, fallbackIntent.confidence),
});

const parsePriceIntent = (prompt) => {
    const pricePattern = '([0-9][0-9,]*(?:\\.[0-9]+)?)';
    const maxPatterns = [
        new RegExp(`(?:under|below|less than|up to|within|max(?:imum)?|budget(?: of)?|<=)\\s*\\$?${pricePattern}`, 'i'),
        new RegExp(`\\$?${pricePattern}\\s*(?:or less|and below|max(?:imum)?)`, 'i'),
    ];
    const minPatterns = [
        new RegExp(`(?:over|above|more than|at least|min(?:imum)?|>=)\\s*\\$?${pricePattern}`, 'i'),
        new RegExp(`\\$?${pricePattern}\\s*(?:or more|and above|min(?:imum)?)`, 'i'),
    ];
    const betweenMatch = prompt.match(new RegExp(`between\\s*\\$?${pricePattern}\\s*(?:and|to|-)\\s*\\$?${pricePattern}`, 'i'));

    if (betweenMatch) {
        return {
            minPrice: normalizePositiveNumber(betweenMatch[1]),
            maxPrice: normalizePositiveNumber(betweenMatch[2]),
        };
    }

    const maxMatch = maxPatterns.map((pattern) => prompt.match(pattern)).find(Boolean);
    const minMatch = minPatterns.map((pattern) => prompt.match(pattern)).find(Boolean);

    return {
        minPrice: minMatch ? normalizePositiveNumber(minMatch[1]) : null,
        maxPrice: maxMatch ? normalizePositiveNumber(maxMatch[1]) : null,
    };
};

const inferDepartment = (prompt, partialIntent, validValues) => {
    const directDepartment = findPromptMatch(prompt, validValues.departments);

    if (directDepartment) {
        return directDepartment;
    }

    const hasFashionSignals =
        partialIntent.category ||
        partialIntent.productType ||
        partialIntent.gender ||
        partialIntent.requestedColors.length > 0 ||
        partialIntent.requestedSizes.length > 0 ||
        partialIntent.requestedMaterials.length > 0 ||
        partialIntent.fit ||
        partialIntent.occasion ||
        partialIntent.season ||
        partialIntent.styleTags.length > 0 ||
        /\b(outfit|fashion|clothes|clothing|wear|dress|shoe|shirt|hoodie|jacket|jeans|trouser|bag|cotton|linen|winter|summer)\b/i.test(prompt);

    if (hasFashionSignals) {
        return getCanonicalValue('fashion', validValues.departments);
    }

    return null;
};

const findSizeAliasMatches = (prompt, validSizes) => {
    const sizeAliases = [
        { pattern: /\b(?:extra[-\s]*extra[-\s]*large|double[-\s]*extra[-\s]*large|2xl|xxl)\b/i, value: 'XXL' },
        { pattern: /\b(?:extra[-\s]*large|x[-\s]*large|xl)\b/i, value: 'XL' },
        { pattern: /\b(?:large|lg)\b/i, value: 'L' },
        { pattern: /\b(?:medium|med)\b/i, value: 'M' },
        { pattern: /\b(?:small|sm)\b/i, value: 'S' },
    ];
    const matchedSizes = sizeAliases
        .filter(({ pattern }) => pattern.test(prompt))
        .map(({ value }) => getCanonicalValue(value, validSizes))
        .filter(Boolean);

    return Array.from(new Set(matchedSizes));
};

const parseRuleBasedIntent = (prompt, validValues) => {
    const priceIntent = parsePriceIntent(prompt);
    const lowerPrompt = prompt.toLowerCase();
    const requestedSizes = Array.from(
        new Set([
            ...findPromptMatches(prompt, validValues.sizes),
            ...findSizeAliasMatches(prompt, validValues.sizes),
        ])
    );
    const sortBy = lowerPrompt.includes('cheapest') || lowerPrompt.includes('lowest price')
        ? 'price_low'
        : lowerPrompt.includes('highest price') || lowerPrompt.includes('expensive')
            ? 'price_high'
            : lowerPrompt.includes('best rated') || lowerPrompt.includes('top rated')
                ? 'rating'
                : lowerPrompt.includes('new') || lowerPrompt.includes('latest')
                    ? 'newest'
                    : 'recommended';

    const partialIntent = {
        ...DEFAULT_INTENT,
        category: findPromptMatch(prompt, validValues.categories, { allowPartialToken: true }),
        productType: findPromptMatch(prompt, validValues.productTypes, { allowPartialToken: true }),
        brand: findPromptMatch(prompt, validValues.brands),
        gender: findPromptMatch(prompt, validValues.genders),
        requestedColors: findPromptMatches(prompt, validValues.colors, { allowPartialToken: true }),
        requestedSizes,
        requestedMaterials: findPromptMatches(prompt, validValues.materials, { allowPartialToken: true }),
        fit: findPromptMatch(prompt, validValues.fits),
        occasion: findPromptMatch(prompt, validValues.occasions),
        season: findPromptMatch(prompt, validValues.seasons),
        styleTags: findPromptMatches(prompt, validValues.styleTags, { allowPartialToken: true }),
        minPrice: priceIntent.minPrice,
        maxPrice: priceIntent.maxPrice,
        sortBy,
        confidence: 0.45,
    };

    partialIntent.department = inferDepartment(prompt, partialIntent, validValues);

    return validateIntent(partialIntent, validValues);
};

const stripJsonFences = (value) =>
    String(value || '')
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

const parseJsonFromText = (value) => {
    const text = stripJsonFences(value);

    try {
        return JSON.parse(text);
    } catch (error) {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
            throw error;
        }

        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    }
};

const buildOllamaPrompt = (prompt, validValues) => `
You convert ecommerce shopper prompts into a strict JSON search intent.
Return valid JSON only. Do not use markdown fences. Do not return MongoDB update/query syntax.

Rules:
- Return one plain top-level JSON object with exactly the keys from Expected JSON shape.
- Never include "$set", "$match", "$and", "$or", "intent", "filters", "filter", or "query" wrapper keys.
- Only use values from the valid DB values below.
- If no exact valid value exists, return null or [].
- Do not invent categories, brands, materials, colors, sizes, or product types.
- Do not put "cloth" or "clothing" into category unless that exact category exists.
- For clothing/fashion products, use department "fashion" only if it exists in valid departments.
- category should be product family, such as "Dresses".
- productType should be normalized exact type, such as "dress".
- "tshirt", "tee", and "t-shirt" can map to category "T-Shirts" and productType "t-shirt" when those values exist.
- Size words can map to exact sizes: small -> "S", medium -> "M", large -> "L", extra large -> "XL".
- "under 1000", "below 1000", "less than 1000", "up to 1000" become maxPrice: 1000.
- "over 500", "above 500", "more than 500", "at least 500" become minPrice: 500.
- If the user explicitly says a color/material/size, put it in requestedColors/requestedMaterials/requestedSizes.
- If a color/material/size only comes from wishlist or order history, do not put it in requested fields.
- Use sortBy only as one of: recommended, price_low, price_high, rating, newest.

Expected JSON shape:
{
  "department": null,
  "category": null,
  "productType": null,
  "brand": null,
  "gender": null,
  "minPrice": null,
  "maxPrice": null,
  "requestedColors": [],
  "requestedSizes": [],
  "requestedMaterials": [],
  "fit": null,
  "occasion": null,
  "season": null,
  "styleTags": [],
  "sortBy": "recommended",
  "confidence": 0
}

Valid DB values:
${JSON.stringify(validValues, null, 2)}

User prompt:
${prompt}
`;

const parseWithOllama = async (prompt, validValues) => {
    if (typeof fetch !== 'function') {
        throw new Error('Global fetch is not available in this Node runtime');
    }

    const baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, '');
    const model = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
    const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS) || DEFAULT_OLLAMA_TIMEOUT_MS;
    const url = `${baseUrl}/api/generate`;
    const ollamaPrompt = buildOllamaPrompt(prompt, validValues);
    const startedAt = Date.now();
    let timedOut = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);
    const headers = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
    };
    const basicAuthUser = process.env.OLLAMA_BASIC_AUTH_USER;
    const basicAuthPass = process.env.OLLAMA_BASIC_AUTH_PASS;

    if (basicAuthUser && basicAuthPass) {
        headers.Authorization = `Basic ${Buffer.from(`${basicAuthUser}:${basicAuthPass}`).toString('base64')}`;
    }

    logOllamaDebug('[ollama:intent] request', {
        url,
        model,
        timeoutMs,
        promptCharacters: ollamaPrompt.length,
    });
    logOllamaDebug(`[ollama:intent] prompt:\n${ollamaPrompt}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model,
                prompt: ollamaPrompt,
                stream: false,
                format: 'json',
                options: {
                    temperature: 0,
                },
            }),
            signal: controller.signal,
        });
        const elapsedMs = Date.now() - startedAt;
        const responseText = await response.text();

        logOllamaDebug('[ollama:intent] response meta', {
            status: response.status,
            ok: response.ok,
            elapsedMs,
            responseCharacters: responseText.length,
        });
        logOllamaDebug(`[ollama:intent] raw response body:\n${responseText}`);

        if (!response.ok) {
            throw new Error(`Ollama request failed with status ${response.status}: ${responseText.slice(0, 240)}`);
        }

        const data = JSON.parse(responseText);
        logOllamaDebug(`[ollama:intent] model response text:\n${data.response || ''}`);

        const parsedIntent = parseJsonFromText(data.response);
        logOllamaDebug('[ollama:intent] parsed intent', parsedIntent);

        return parsedIntent;
    } catch (error) {
        if (timedOut) {
            throw new Error(
                `Ollama request timed out after ${timeoutMs}ms while using model "${model}" at ${url}. ` +
                    'Increase OLLAMA_TIMEOUT_MS or reduce the prompt/valid DB values if the model needs longer to answer.',
                { cause: error }
            );
        }

        logOllamaDebug('[ollama:intent] error', {
            name: error.name,
            message: error.message,
        });
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};

const getProductValidValues = async () => {
    const [
        departments,
        categories,
        brands,
        genders,
        colors,
        sizes,
        materials,
        fits,
        occasions,
        seasons,
        styleTags,
        productTypes,
    ] = await Promise.all([
        Product.distinct('department'),
        Product.distinct('category'),
        Product.distinct('brand'),
        Product.distinct('gender'),
        Product.distinct('colors'),
        Product.distinct('sizes'),
        Product.distinct('material'),
        Product.distinct('fit'),
        Product.distinct('occasion'),
        Product.distinct('season'),
        Product.distinct('styleTags'),
        Product.distinct('productType'),
    ]);

    return {
        departments: cleanDistinctValues(departments),
        categories: cleanDistinctValues(categories),
        brands: cleanDistinctValues(brands),
        genders: cleanDistinctValues(genders),
        colors: cleanDistinctValues(colors),
        sizes: cleanDistinctValues(sizes),
        materials: cleanDistinctValues(materials),
        fits: cleanDistinctValues(fits),
        occasions: cleanDistinctValues(occasions),
        seasons: cleanDistinctValues(seasons),
        styleTags: cleanDistinctValues(styleTags),
        productTypes: cleanDistinctValues(productTypes),
    };
};

const parseRecommendationIntent = async (prompt) => {
    const validValues = await getProductValidValues();
    const ruleBasedIntent = parseRuleBasedIntent(prompt, validValues);

    try {
        const rawIntent = await parseWithOllama(prompt, validValues);
        const ollamaIntent = validateIntent(rawIntent, validValues);
        const intent = mergeMissingIntentValues(ollamaIntent, ruleBasedIntent);
        const parserFallbackUsed = !hasMeaningfulIntent(ollamaIntent) && hasMeaningfulIntent(ruleBasedIntent);

        if (parserFallbackUsed) {
            logOllamaDebug('[ollama:intent] model returned empty intent; using rule-based intent', ruleBasedIntent);
        } else if (JSON.stringify(intent) !== JSON.stringify(ollamaIntent)) {
            logOllamaDebug('[ollama:intent] filled missing model fields from rule-based parser', intent);
        }

        return {
            intent,
            validValues,
            parserFallbackUsed,
        };
    } catch (error) {
        console.error('Ollama intent parsing failed, using rule-based parser:', error.message);

        return {
            intent: ruleBasedIntent,
            validValues,
            parserFallbackUsed: true,
        };
    }
};

export { getProductValidValues, parseRecommendationIntent, validateIntent };
