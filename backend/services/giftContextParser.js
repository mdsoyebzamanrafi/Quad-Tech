const DEFAULT_GIFT_CONTEXT = {
    recipientType: 'someone',
    recipientGender: 'unknown',
    relationshipType: 'general',
    occasion: null,
    budgetMin: null,
    budgetMax: null,
    preferredCategories: [],
    preferredColors: [],
    preferredStyleTags: [],
    departmentPreference: 'mixed',
};

const AMOUNT_PATTERN = '(?:৳\\s*|tk\\.?\\s*|taka\\s*|bdt\\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+(?:\\.[0-9]+)?)(?:\\s*(?:tk|taka|bdt))?';

const recipientDefinitions = [
    {
        patterns: [/\bgirlfriend\b/],
        value: {
            recipientType: 'girlfriend',
            recipientGender: 'female',
            relationshipType: 'romantic',
            departmentPreference: 'fashion',
        },
    },
    {
        patterns: [/\bboyfriend\b/],
        value: {
            recipientType: 'boyfriend',
            recipientGender: 'male',
            relationshipType: 'romantic',
            departmentPreference: 'mixed',
        },
    },
    {
        patterns: [/\bwife\b/],
        value: {
            recipientType: 'wife',
            recipientGender: 'female',
            relationshipType: 'romantic',
            departmentPreference: 'fashion',
        },
    },
    {
        patterns: [/\bhusband\b/],
        value: {
            recipientType: 'husband',
            recipientGender: 'male',
            relationshipType: 'romantic',
            departmentPreference: 'mixed',
        },
    },
    {
        patterns: [/\bmother\b/, /\bmom\b/, /\bma\b/],
        value: {
            recipientType: 'mother',
            recipientGender: 'female',
            relationshipType: 'family',
            departmentPreference: 'fashion',
        },
    },
    {
        patterns: [/\bfather\b/, /\bdad\b/, /\bbaba\b/],
        value: {
            recipientType: 'father',
            recipientGender: 'male',
            relationshipType: 'family',
            departmentPreference: 'mixed',
        },
    },
    {
        patterns: [/\bsister\b/],
        value: {
            recipientType: 'sister',
            recipientGender: 'female',
            relationshipType: 'family',
            departmentPreference: 'fashion',
        },
    },
    {
        patterns: [/\bbrother\b/],
        value: {
            recipientType: 'brother',
            recipientGender: 'male',
            relationshipType: 'family',
            departmentPreference: 'mixed',
        },
    },
    {
        patterns: [/\bfriend\b/],
        value: {
            recipientType: 'friend',
            recipientGender: 'unknown',
            relationshipType: 'friend',
            departmentPreference: 'mixed',
        },
    },
    {
        patterns: [/\bcolleague\b/, /\bcoworker\b/, /\bteacher\b/, /\bboss\b/],
        value: {
            recipientType: 'colleague',
            recipientGender: 'unknown',
            relationshipType: 'professional',
            departmentPreference: 'mixed',
        },
    },
    {
        patterns: [/\bsibling\b/, /\bfamily\b/],
        value: {
            recipientType: 'family',
            recipientGender: 'unknown',
            relationshipType: 'family',
            departmentPreference: 'mixed',
        },
    },
];

const occasionDefinitions = [
    { occasion: "Mother's Day", patterns: [/\bmother'?s day\b/, /\bmothers day\b/] },
    { occasion: "Father's Day", patterns: [/\bfather'?s day\b/, /\bfathers day\b/] },
    { occasion: "Valentine's Day", patterns: [/\bvalentine'?s day\b/, /\bvalentines\b/, /\bvalentine\b/] },
    { occasion: 'Eid-ul-Fitr', patterns: [/\beid[-\s]?ul[-\s]?fitr\b/, /\bfitr\b/] },
    { occasion: 'Eid-ul-Adha', patterns: [/\beid[-\s]?ul[-\s]?adha\b/, /\bqurbani eid\b/, /\badha\b/] },
    { occasion: 'Eid', patterns: [/\beid\b/] },
    { occasion: 'Pohela Boishakh', patterns: [/\bpohela boishakh\b/, /\bboishakh\b/, /\bboishakhi\b/] },
    { occasion: 'Durga Puja', patterns: [/\bdurga puja\b/, /\bpuja\b/] },
    { occasion: 'Birthday', patterns: [/\bbirthday\b/, /\bbday\b/] },
    { occasion: 'Anniversary', patterns: [/\banniversary\b/, /\banniv\b/] },
    { occasion: 'Wedding', patterns: [/\bwedding\b/, /\bmarriage\b/, /\bbiye\b/] },
    { occasion: 'General Gift', patterns: [/\bgeneral gift\b/] },
];

const categoryDefinitions = [
    { category: 'Smartwatches', department: 'electronics', patterns: [/\bsmart\s*watch(?:es)?\b/, /\bsmartwatch(?:es)?\b/] },
    { category: 'Power Banks', department: 'electronics', patterns: [/\bpower\s*bank(?:s)?\b/, /\bpowerbank(?:s)?\b/] },
    { category: 'Earbuds', department: 'electronics', patterns: [/\bearbuds?\b/, /\bbuds\b/, /\bpods\b/] },
    { category: 'Headphones', department: 'electronics', patterns: [/\bheadphones?\b/, /\bheadsets?\b/] },
    { category: 'Smartphones', department: 'electronics', patterns: [/\bsmartphones?\b/, /\bphone\b/, /\bmobile\b/] },
    { category: 'Laptops', department: 'electronics', patterns: [/\blaptops?\b/] },
    { category: 'Cameras', department: 'electronics', patterns: [/\bcameras?\b/] },
    { category: 'Gaming', department: 'electronics', patterns: [/\bgaming\b/] },
    { category: 'Accessories', department: 'electronics', patterns: [/\bgadget\b/, /\bgadgets\b/, /\belectronics?\b/] },
    { category: 'T-Shirts', department: 'fashion', patterns: [/\bt[\s-]?shirts?\b/, /\btshirts?\b/] },
    { category: 'Shirts', department: 'fashion', patterns: [/\bshirts?\b/] },
    { category: 'Hoodies', department: 'fashion', patterns: [/\bhoodies\b/, /\bhoodie\b/] },
    { category: 'Jackets', department: 'fashion', patterns: [/\bjackets?\b/] },
    { category: 'Jeans', department: 'fashion', patterns: [/\bjeans\b/] },
    { category: 'Trousers', department: 'fashion', patterns: [/\btrousers\b/, /\bpants\b/] },
    { category: 'Dresses', department: 'fashion', patterns: [/\bdresses\b/, /\bdress\b/] },
    { category: 'Shoes', department: 'fashion', patterns: [/\bshoes\b/, /\bsneakers\b/] },
    { category: 'Bags', department: 'fashion', patterns: [/\bbags?\b/, /\bhandbags?\b/] },
    { category: 'Watches', department: 'fashion', patterns: [/\bwatches\b/, /\bwatch\b/] },
    { category: 'Accessories', department: 'fashion', patterns: [/\baccessories\b/, /\baccessory\b/] },
    { category: 'Ethnic Wear', department: 'fashion', patterns: [/\bethnic\b/] },
    { category: 'Panjabi', department: 'fashion', patterns: [/\bpanjabi\b/, /\bpunjabi\b/] },
    { category: 'Sharee', department: 'fashion', patterns: [/\bsharee\b/, /\bsaree\b/] },
    { category: 'Salowar Kamiz', department: 'fashion', patterns: [/\bsalowar\b/, /\bsalwar\b/, /\bkamiz\b/, /\bkameez\b/] },
];

const colorDefinitions = [
    { value: 'red', patterns: [/\bred\b/] },
    { value: 'pink', patterns: [/\bpink\b/] },
    { value: 'white', patterns: [/\bwhite\b/] },
    { value: 'black', patterns: [/\bblack\b/] },
    { value: 'blue', patterns: [/\bblue\b/] },
    { value: 'green', patterns: [/\bgreen\b/] },
    { value: 'yellow', patterns: [/\byellow\b/] },
    { value: 'gold', patterns: [/\bgolden\b/, /\bgold\b/] },
    { value: 'silver', patterns: [/\bsilver\b/] },
    { value: 'purple', patterns: [/\bpurple\b/] },
    { value: 'brown', patterns: [/\bbrown\b/] },
    { value: 'maroon', patterns: [/\bmaroon\b/] },
    { value: 'beige', patterns: [/\bbeige\b/] },
];

const styleDefinitions = [
    { value: 'romantic', patterns: [/\bromantic\b/] },
    { value: 'elegant', patterns: [/\belegant\b/] },
    { value: 'premium', patterns: [/\bpremium\b/, /\bluxury\b/] },
    { value: 'traditional', patterns: [/\btraditional\b/] },
    { value: 'festive', patterns: [/\bfestive\b/] },
    { value: 'practical', patterns: [/\bpractical\b/] },
    { value: 'formal', patterns: [/\bformal\b/] },
    { value: 'casual', patterns: [/\bcasual\b/] },
    { value: 'trendy', patterns: [/\btrendy\b/, /\bfashionable\b/] },
    { value: 'giftable', patterns: [/\bgiftable\b/] },
    { value: 'classic', patterns: [/\bclassic\b/] },
    { value: 'comfortable', patterns: [/\bcomfortable\b/, /\bcomfort\b/] },
    { value: 'ethnic', patterns: [/\bethnic\b/] },
    { value: 'professional', patterns: [/\bprofessional\b/] },
];

const uniqueValues = (values) => Array.from(new Set(values.filter(Boolean)));

const toAmount = (value) => {
    const parsed = Number(String(value || '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const findBudget = (message) => {
    const betweenMatch = message.match(
        new RegExp(`\\bbetween\\s+${AMOUNT_PATTERN}\\s+(?:and|to|-)\\s+${AMOUNT_PATTERN}`, 'i')
    );

    if (betweenMatch) {
        const firstAmount = toAmount(betweenMatch[1]);
        const secondAmount = toAmount(betweenMatch[2]);

        if (firstAmount !== null && secondAmount !== null) {
            return {
                budgetMin: Math.min(firstAmount, secondAmount),
                budgetMax: Math.max(firstAmount, secondAmount),
            };
        }
    }

    const aroundMatch = message.match(
        new RegExp(`\\b(?:around|about|approximately)\\s+${AMOUNT_PATTERN}`, 'i')
    );

    if (aroundMatch) {
        const amount = toAmount(aroundMatch[1]);

        if (amount !== null) {
            return {
                budgetMin: Math.round(amount * 0.8),
                budgetMax: Math.round(amount * 1.2),
            };
        }
    }

    const maxMatch = message.match(
        new RegExp(`\\b(?:under|below|less than|within|budget|max|up to)\\s+${AMOUNT_PATTERN}`, 'i')
    );

    if (maxMatch) {
        const amount = toAmount(maxMatch[1]);

        if (amount !== null) {
            return {
                budgetMin: null,
                budgetMax: amount,
            };
        }
    }

    return {
        budgetMin: null,
        budgetMax: null,
    };
};

const parseGiftContext = (message) => {
    const normalizedMessage = typeof message === 'string' ? message.trim().toLowerCase() : '';

    if (!normalizedMessage) {
        return { ...DEFAULT_GIFT_CONTEXT };
    }

    const recipientMatch =
        recipientDefinitions.find((definition) =>
            definition.patterns.some((pattern) => pattern.test(normalizedMessage))
        )?.value || {};

    const occasion =
        occasionDefinitions.find((definition) =>
            definition.patterns.some((pattern) => pattern.test(normalizedMessage))
        )?.occasion || null;

    const budgets = findBudget(normalizedMessage);

    const preferredCategories = [];
    let sawFashionHint = false;
    let sawElectronicsHint = false;

    categoryDefinitions.forEach((definition) => {
        if (definition.patterns.some((pattern) => pattern.test(normalizedMessage))) {
            preferredCategories.push(definition.category);

            if (definition.department === 'fashion') {
                sawFashionHint = true;
            }

            if (definition.department === 'electronics') {
                sawElectronicsHint = true;
            }
        }
    });

    const preferredColors = colorDefinitions
        .filter((definition) => definition.patterns.some((pattern) => pattern.test(normalizedMessage)))
        .map((definition) => definition.value);

    const preferredStyleTags = styleDefinitions
        .filter((definition) => definition.patterns.some((pattern) => pattern.test(normalizedMessage)))
        .map((definition) => definition.value);

    let departmentPreference = recipientMatch.departmentPreference || 'mixed';

    if (sawFashionHint && sawElectronicsHint) {
        departmentPreference = 'mixed';
    } else if (sawElectronicsHint) {
        departmentPreference = 'electronics';
    } else if (sawFashionHint) {
        departmentPreference = 'fashion';
    }

    return {
        recipientType: recipientMatch.recipientType || DEFAULT_GIFT_CONTEXT.recipientType,
        recipientGender: recipientMatch.recipientGender || DEFAULT_GIFT_CONTEXT.recipientGender,
        relationshipType: recipientMatch.relationshipType || DEFAULT_GIFT_CONTEXT.relationshipType,
        occasion,
        budgetMin: budgets.budgetMin,
        budgetMax: budgets.budgetMax,
        preferredCategories: uniqueValues(preferredCategories),
        preferredColors: uniqueValues(preferredColors),
        preferredStyleTags: uniqueValues(preferredStyleTags),
        departmentPreference,
    };
};

export { parseGiftContext };
