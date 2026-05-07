import Product from '../models/Product.js';

const FIELD_MAP = {
    department: 'departments',
    category: 'categories',
    brand: 'brands',
    gender: 'genders',
    colors: 'colors',
    sizes: 'sizes',
    material: 'materials',
    fit: 'fits',
    occasion: 'occasions',
    season: 'seasons',
    styleTags: 'styleTags',
    productType: 'productTypes',
};

const normalizeDistinctValues = (values) => {
    const flattenedValues = (Array.isArray(values) ? values : [])
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean);

    return Array.from(new Set(flattenedValues)).sort((firstValue, secondValue) =>
        firstValue.localeCompare(secondValue)
    );
};

const getProductAttributeValues = async () => {
    const fieldEntries = Object.entries(FIELD_MAP);
    const distinctResults = await Promise.all(
        fieldEntries.map(([fieldName]) => Product.distinct(fieldName))
    );

    return fieldEntries.reduce((accumulator, [, outputKey], index) => {
        accumulator[outputKey] = normalizeDistinctValues(distinctResults[index]);
        return accumulator;
    }, {});
};

export { getProductAttributeValues, normalizeDistinctValues };
