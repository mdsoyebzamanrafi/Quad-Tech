import bangladeshOccasions from '../data/bangladeshOccasions.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizeText = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[-/]+/g, ' ')
        .replace(/\s+/g, ' ');

const startOfDay = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

const getOccasionByName = (name) =>
    bangladeshOccasions.find(
        (occasion) =>
            normalizeText(occasion.name) === normalizeText(name) ||
            occasion.keywords.some((keyword) => normalizeText(keyword) === normalizeText(name))
    ) || null;

const getUpcomingInfo = (occasion, today) => {
    const dateRule = occasion?.dateRule || {};

    if (!dateRule.type || dateRule.type === 'none') {
        return null;
    }

    const currentDay = startOfDay(today);
    const targetDate = new Date(currentDay.getFullYear(), Number(dateRule.month) - 1, Number(dateRule.day));
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate < currentDay) {
        targetDate.setFullYear(targetDate.getFullYear() + 1);
    }

    const daysUntil = Math.round((targetDate.getTime() - currentDay.getTime()) / DAY_IN_MS);

    return {
        targetDate,
        daysUntil,
        isWithinWindow:
            Number.isFinite(daysUntil) &&
            daysUntil >= 0 &&
            daysUntil <= Number(occasion.windowBeforeDays || 0),
    };
};

const getNearestUpcomingEid = (today) => {
    const eidOptions = ['Eid-ul-Fitr', 'Eid-ul-Adha']
        .map((name) => getOccasionByName(name))
        .filter(Boolean)
        .map((occasion) => ({
            occasion,
            upcomingInfo: getUpcomingInfo(occasion, today),
        }))
        .filter((item) => item.upcomingInfo);

    const upcoming = eidOptions
        .filter((item) => item.upcomingInfo.daysUntil >= 0)
        .sort((firstItem, secondItem) => firstItem.upcomingInfo.daysUntil - secondItem.upcomingInfo.daysUntil);

    if (upcoming.length > 0) {
        return upcoming[0].occasion;
    }

    return getOccasionByName('Eid-ul-Fitr');
};

const getBangladeshOccasionContext = (giftContext, today = new Date()) => {
    const requestedOccasion = normalizeText(giftContext?.occasion);

    if (requestedOccasion) {
        if (requestedOccasion === 'eid') {
            return {
                activeOccasion: getNearestUpcomingEid(today),
                source: 'user-mentioned',
            };
        }

        const matchedOccasion = getOccasionByName(requestedOccasion);

        if (matchedOccasion) {
            return {
                activeOccasion: matchedOccasion,
                source: 'user-mentioned',
            };
        }
    }

    const upcomingOccasions = bangladeshOccasions
        .map((occasion) => ({
            occasion,
            upcomingInfo: getUpcomingInfo(occasion, today),
        }))
        .filter((item) => item.upcomingInfo?.isWithinWindow)
        .sort((firstItem, secondItem) => firstItem.upcomingInfo.daysUntil - secondItem.upcomingInfo.daysUntil);

    if (upcomingOccasions.length > 0) {
        return {
            activeOccasion: upcomingOccasions[0].occasion,
            source: 'upcoming',
        };
    }

    return {
        activeOccasion: getOccasionByName('General Gift'),
        source: 'default',
    };
};

export { getBangladeshOccasionContext };
