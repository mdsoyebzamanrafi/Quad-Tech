const normalizeString = (value) => String(value || '').trim().toLowerCase();

const normalizeDepartment = (department) =>
    normalizeString(department) === 'fashion' ? 'fashion' : 'electronics';

const normalizeList = (values) =>
    Array.isArray(values)
        ? values
            .filter((value) => typeof value === 'string')
            .map((value) => normalizeString(value))
            .filter(Boolean)
        : [];

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const addReason = (reasons, reason) => {
    if (reason && !reasons.includes(reason)) {
        reasons.push(reason);
    }
};

const looseMatch = (firstValue, secondValue) =>
    firstValue === secondValue || firstValue.includes(secondValue) || secondValue.includes(firstValue);

const listMatches = (values, candidates) => {
    const normalizedValues = normalizeList(values);
    const normalizedCandidates = normalizeList(candidates);

    return normalizedValues.some((value) =>
        normalizedCandidates.some((candidate) => looseMatch(value, candidate))
    );
};

const buildProductCategoryAliases = (product) => {
    const aliases = new Set();
    const category = normalizeString(product.category);
    const productType = normalizeString(product.productType);
    const searchableText = [
        normalizeString(product.name),
        normalizeString(product.description),
        productType,
        ...normalizeList(product.styleTags),
    ].join(' ');

    if (category) {
        aliases.add(category);
    }

    if (productType) {
        aliases.add(productType);
    }

    aliases.add(normalizeDepartment(product.department));

    if (category === 'wearables') {
        aliases.add('smartwatches');
        aliases.add('watches');
    }

    if (category === 'smartphones') {
        aliases.add('smartphone');
        aliases.add('phone');
        aliases.add('mobile');
    }

    if (category === 'laptops') {
        aliases.add('laptop');
    }

    if (category === 'cameras') {
        aliases.add('camera');
    }

    if (category === 'bags') {
        aliases.add('bag');
    }

    if (category === 'watches') {
        aliases.add('watch');
    }

    if (category === 't-shirts') {
        aliases.add('tshirt');
        aliases.add('t-shirt');
    }

    if (category === 'shirts') {
        aliases.add('shirt');
    }

    if (category === 'hoodies') {
        aliases.add('hoodie');
    }

    if (category === 'jackets') {
        aliases.add('jacket');
    }

    if (category === 'jeans') {
        aliases.add('jean');
    }

    if (category === 'trousers') {
        aliases.add('trouser');
    }

    if (category === 'dresses') {
        aliases.add('dress');
    }

    if (category === 'shoes') {
        aliases.add('shoe');
        aliases.add('sneakers');
    }

    if (category === 'panjabi') {
        aliases.add('ethnic wear');
    }

    if (category === 'sharee' || category === 'salowar kamiz') {
        aliases.add('ethnic wear');
    }

    if (/\bheadphones?\b|\bheadsets?\b/.test(searchableText)) {
        aliases.add('headphones');
    }

    if (/\bearbuds?\b|\bbuds\b|\bpods\b/.test(searchableText)) {
        aliases.add('earbuds');
    }

    if (category === 'audio' && !aliases.has('headphones') && !aliases.has('earbuds')) {
        aliases.add('audio');
    }

    if (/\bsmart\s*watch(?:es)?\b|\bsmartwatch(?:es)?\b|\bwatch\b|\btracker\b|\btimepiece\b|\bband\b/.test(searchableText)) {
        aliases.add('smartwatches');
        aliases.add('watches');
    }

    if (/\bpower\s*bank(?:s)?\b|\bpowerbank(?:s)?\b/.test(searchableText)) {
        aliases.add('power banks');
    }

    return aliases;
};

const categoryMatchesAny = (product, categories) => {
    const aliases = buildProductCategoryAliases(product);
    const normalizedCategories = normalizeList(categories);

    return normalizedCategories.some((category) => aliases.has(category));
};

const relationshipProfiles = {
    romanticFemale: {
        categories: [
            'watches',
            'accessories',
            'bags',
            'dresses',
            'sharee',
            'salowar kamiz',
            'ethnic wear',
            'perfume',
            'jewelry',
        ],
        styleTags: ['romantic', 'elegant', 'premium', 'giftable', 'fashionable', 'trendy', 'traditional'],
        colors: ['red', 'pink', 'white', 'gold', 'golden', 'silver', 'maroon'],
    },
    romanticMale: {
        categories: [
            'watches',
            'shirts',
            'panjabi',
            'headphones',
            'earbuds',
            'smartwatches',
            'power banks',
            'bags',
            'accessories',
            'gaming',
        ],
        styleTags: ['premium', 'practical', 'classic', 'formal', 'giftable', 'trendy'],
        colors: ['black', 'blue', 'brown', 'silver', 'white'],
    },
    familyFemale: {
        categories: ['sharee', 'salowar kamiz', 'ethnic wear', 'watches', 'bags', 'accessories', 'dresses'],
        styleTags: ['elegant', 'traditional', 'premium', 'giftable', 'comfortable', 'ethnic'],
        colors: ['pink', 'maroon', 'gold', 'beige', 'white'],
    },
    familyMale: {
        categories: ['watches', 'shirts', 'panjabi', 'headphones', 'earbuds', 'power banks', 'smartwatches', 'bags', 'accessories'],
        styleTags: ['practical', 'premium', 'classic', 'formal', 'giftable', 'traditional'],
        colors: ['black', 'blue', 'brown', 'silver', 'white'],
    },
    professional: {
        categories: ['watches', 'shirts', 'accessories', 'headphones', 'earbuds', 'power banks', 'bags'],
        styleTags: ['professional', 'formal', 'practical', 'classic', 'premium', 'giftable'],
        colors: ['black', 'blue', 'brown', 'silver', 'white'],
        inappropriateCategories: ['dresses', 'sharee', 'salowar kamiz', 'perfume', 'jewelry'],
        inappropriateStyleTags: ['romantic'],
    },
    friendGeneral: {
        categories: ['watches', 'headphones', 'earbuds', 'bags', 'accessories', 'shirts', 't-shirts', 'hoodies', 'power banks', 'smartwatches'],
        styleTags: ['casual', 'trendy', 'practical', 'giftable', 'premium'],
        colors: ['black', 'blue', 'white', 'brown', 'silver'],
    },
};

const mergeProfiles = (...profiles) => ({
    categories: Array.from(new Set(profiles.flatMap((profile) => profile.categories || []))),
    styleTags: Array.from(new Set(profiles.flatMap((profile) => profile.styleTags || []))),
    colors: Array.from(new Set(profiles.flatMap((profile) => profile.colors || []))),
    inappropriateCategories: Array.from(new Set(profiles.flatMap((profile) => profile.inappropriateCategories || []))),
    inappropriateStyleTags: Array.from(new Set(profiles.flatMap((profile) => profile.inappropriateStyleTags || []))),
});

const getRelationshipProfile = (giftContext = {}) => {
    const relationshipType = normalizeString(giftContext.relationshipType);
    const recipientGender = normalizeString(giftContext.recipientGender);

    if (relationshipType === 'romantic') {
        if (recipientGender === 'female') {
            return relationshipProfiles.romanticFemale;
        }

        if (recipientGender === 'male') {
            return relationshipProfiles.romanticMale;
        }

        return mergeProfiles(relationshipProfiles.romanticFemale, relationshipProfiles.romanticMale);
    }

    if (relationshipType === 'family') {
        if (recipientGender === 'female') {
            return relationshipProfiles.familyFemale;
        }

        if (recipientGender === 'male') {
            return relationshipProfiles.familyMale;
        }

        return mergeProfiles(relationshipProfiles.familyFemale, relationshipProfiles.familyMale);
    }

    if (relationshipType === 'professional') {
        return relationshipProfiles.professional;
    }

    return relationshipProfiles.friendGeneral;
};

const scoreGiftProduct = (product, giftContext, occasionContext) => {
    const normalizedProduct = {
        category: normalizeString(product?.category),
        department: normalizeDepartment(product?.department),
        brand: normalizeString(product?.brand),
        name: normalizeString(product?.name),
        description: normalizeString(product?.description),
        productType: normalizeString(product?.productType),
        colors: normalizeList(product?.colors),
        styleTags: normalizeList(product?.styleTags),
        price: toNumber(product?.price),
        rating: toNumber(product?.rating),
        countInStock: toNumber(product?.countInStock),
        isNewArrival: Boolean(product?.isNewArrival),
        adminPriorityScore: Math.max(0, toNumber(product?.adminPriorityScore)),
        isSponsored: Boolean(product?.isSponsored),
        sponsoredWeight: Math.max(0, toNumber(product?.sponsoredWeight)),
    };

    const relationshipProfile = getRelationshipProfile(giftContext);
    const activeOccasion = occasionContext?.activeOccasion || {};
    const reasons = [];

    let relationshipScore = 0;
    let occasionScore = 0;
    let budgetScore = 0;
    let qualityScore = 0;
    let priorityScore = 0;
    let departmentScore = 0;
    let penaltyScore = 0;

    const relationshipCategoryMatch =
        categoryMatchesAny(normalizedProduct, relationshipProfile.categories) ||
        categoryMatchesAny(normalizedProduct, giftContext?.preferredCategories);
    const relationshipStyleMatch =
        listMatches(normalizedProduct.styleTags, relationshipProfile.styleTags) ||
        listMatches(normalizedProduct.styleTags, giftContext?.preferredStyleTags);
    const relationshipColorMatch =
        listMatches(normalizedProduct.colors, relationshipProfile.colors) ||
        listMatches(normalizedProduct.colors, giftContext?.preferredColors);

    if (relationshipCategoryMatch) {
        relationshipScore += 30;
    }

    if (relationshipStyleMatch) {
        relationshipScore += 20;
    }

    if (relationshipColorMatch) {
        relationshipScore += 10;
    }

    const inappropriateRelationshipMatch =
        categoryMatchesAny(normalizedProduct, relationshipProfile.inappropriateCategories) ||
        listMatches(normalizedProduct.styleTags, relationshipProfile.inappropriateStyleTags);

    if (inappropriateRelationshipMatch) {
        penaltyScore -= 30;
    }

    if (categoryMatchesAny(normalizedProduct, activeOccasion.recommendedCategories)) {
        occasionScore += 30;
    }

    if (listMatches(normalizedProduct.colors, activeOccasion.recommendedColors)) {
        occasionScore += 20;
    }

    if (listMatches(normalizedProduct.styleTags, activeOccasion.recommendedStyleTags)) {
        occasionScore += 20;
    }

    occasionScore += Number(
        activeOccasion?.relationshipBoosts?.[giftContext?.relationshipType] || 0
    );

    const budgetMin = toNumber(giftContext?.budgetMin) || null;
    const budgetMax = toNumber(giftContext?.budgetMax) || null;
    const price = normalizedProduct.price;

    if (budgetMin !== null && budgetMax !== null && price >= budgetMin && price <= budgetMax) {
        budgetScore += 25;
    } else if (budgetMax !== null && budgetMin === null && price <= budgetMax) {
        budgetScore += 25;
    } else if (budgetMax !== null && price > budgetMax && price <= budgetMax * 1.15) {
        budgetScore -= 10;
    } else if (budgetMax !== null && price > budgetMax * 1.15) {
        budgetScore -= 50;
    } else if (budgetMin !== null && price > 0 && price < budgetMin) {
        budgetScore += 5;
    }

    if (normalizedProduct.styleTags.includes('giftable')) {
        qualityScore += 20;
    }

    if (listMatches(normalizedProduct.styleTags, ['premium', 'elegant', 'traditional', 'practical', 'classic'])) {
        qualityScore += 10;
    }

    if (normalizedProduct.rating >= 4) {
        qualityScore += 10;
    }

    if (normalizedProduct.countInStock > 0) {
        qualityScore += 10;
    }

    if (normalizedProduct.countInStock > 0 && normalizedProduct.countInStock <= 5) {
        qualityScore += 5;
    }

    if (normalizedProduct.isNewArrival) {
        qualityScore += 10;
    }

    priorityScore += Math.min(normalizedProduct.adminPriorityScore, 20);

    if (normalizedProduct.isSponsored) {
        priorityScore += Math.min(normalizedProduct.sponsoredWeight, 10);
    }

    const departmentPreference = normalizeString(giftContext?.departmentPreference);
    if (departmentPreference === 'fashion' && normalizedProduct.department === 'fashion') {
        departmentScore += 10;
    } else if (departmentPreference === 'electronics' && normalizedProduct.department === 'electronics') {
        departmentScore += 10;
    } else if (departmentPreference === 'fashion' || departmentPreference === 'electronics') {
        departmentScore -= 5;
    }

    const totalBeforeClamp =
        relationshipScore +
        occasionScore +
        budgetScore +
        qualityScore +
        priorityScore +
        departmentScore +
        penaltyScore;

    const giftScore = Math.max(0, Math.min(100, Math.round(totalBeforeClamp)));

    if (relationshipCategoryMatch || relationshipStyleMatch || relationshipColorMatch) {
        const relationshipType = normalizeString(giftContext?.relationshipType);

        if (relationshipType === 'romantic') {
            addReason(reasons, 'Fits a romantic gift profile');
        } else if (relationshipType === 'family') {
            addReason(reasons, 'Balanced choice for a family gift');
        } else if (relationshipType === 'professional') {
            addReason(reasons, 'Balanced choice for a professional gift');
        } else {
            addReason(reasons, 'Versatile option for a friendly gift');
        }
    }

    if (occasionScore > 0) {
        addReason(reasons, 'Matches the selected occasion');
    }

    if (budgetScore >= 25) {
        addReason(reasons, 'Within the requested budget');
    } else if (budgetScore > 0) {
        addReason(reasons, 'Close to the target budget');
    }

    if (normalizedProduct.countInStock > 0) {
        addReason(reasons, 'Currently in stock');
    }

    if (normalizedProduct.styleTags.includes('giftable') || listMatches(normalizedProduct.styleTags, ['premium', 'elegant', 'traditional', 'practical', 'classic'])) {
        addReason(reasons, 'Has gift-friendly style tags');
    }

    if (normalizedProduct.rating >= 4) {
        addReason(reasons, 'Well-rated by customers');
    }

    if (normalizedProduct.isNewArrival) {
        addReason(reasons, 'New arrival with gifting appeal');
    }

    if (departmentScore > 0) {
        addReason(reasons, 'Matches the preferred department');
    }

    if (reasons.length < 3) {
        addReason(reasons, 'Real in-stock Quad Tech product');
    }

    if (reasons.length < 3) {
        addReason(reasons, 'Useful choice for the current gift search');
    }

    return {
        giftScore,
        reasons: reasons.slice(0, 7),
        scoreBreakdown: {
            relationshipScore,
            occasionScore,
            budgetScore,
            qualityScore,
            priorityScore,
            departmentScore,
            penaltyScore,
            totalBeforeClamp,
        },
    };
};

export { scoreGiftProduct, getRelationshipProfile };
