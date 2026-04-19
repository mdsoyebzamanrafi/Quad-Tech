import ApiError from '../errors/ApiError.js';
import {
    ORDER_STATUSES,
    ORDER_STATUS_TRANSITIONS,
    PAYMENT_STATUS_TRANSITIONS,
} from '../constants/domainConstants.js';

const assertOrderStatusTransition = (currentStatus, nextStatus, { alreadyDispatched = false } = {}) => {
    if (currentStatus === nextStatus) {
        return;
    }

    const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(nextStatus)) {
        throw new ApiError(400, `Invalid order status transition: ${currentStatus} -> ${nextStatus}`);
    }

    if (
        currentStatus === ORDER_STATUSES.PROCESSING &&
        nextStatus === ORDER_STATUSES.CANCELLED &&
        alreadyDispatched
    ) {
        throw new ApiError(400, 'Processing order cannot be cancelled after dispatch');
    }
};

const assertPaymentStatusTransition = (currentStatus, nextStatus) => {
    if (currentStatus === nextStatus) {
        return;
    }

    const allowedTransitions = PAYMENT_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(nextStatus)) {
        throw new ApiError(400, `Invalid payment status transition: ${currentStatus} -> ${nextStatus}`);
    }
};

export { assertOrderStatusTransition, assertPaymentStatusTransition };
