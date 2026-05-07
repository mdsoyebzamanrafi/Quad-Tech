import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';

const normalizeList = (values) =>
    Array.isArray(values)
        ? values
            .filter((value) => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean)
        : [];

const getValue = (value) => (typeof value === 'string' && value.trim() ? value.trim() : 'Not detected');

const AttributeRow = ({ label, value }) => (
    <div className="cloud-closet-attribute-row">
        <span>{label}</span>
        <strong>{getValue(value)}</strong>
    </div>
);

const ChipList = ({ label, values }) => {
    const normalizedValues = normalizeList(values);

    return (
        <div className="cloud-closet-chip-group">
            <span>{label}</span>
            {normalizedValues.length > 0 ? (
                <div className="cloud-closet-chips">
                    {normalizedValues.map((value) => (
                        <span key={value} className="cloud-closet-chip">
                            {value}
                        </span>
                    ))}
                </div>
            ) : (
                <strong>Not detected</strong>
            )}
        </div>
    );
};

const CloudClosetItemCard = ({
    item,
    deleting,
    reanalyzing,
    onDelete,
    onReanalyze,
}) => {
    const attributes = item.attributes || {};
    const confidence =
        Number(attributes.confidence) > 0
            ? `${Math.round(Number(attributes.confidence) * 100)}% confidence`
            : 'Confidence unavailable';

    return (
        <article className="cloud-closet-card">
            <div className="cloud-closet-image-wrap">
                <img src={item.imageUrl} alt={item.originalFilename || 'Cloud Closet item'} />
                <span className={`cloud-closet-status status-${item.analysisStatus}`}>
                    {item.analysisStatus}
                </span>
            </div>

            <div className="cloud-closet-card-body">
                <div className="cloud-closet-card-heading">
                    <div>
                        <p className="cloud-closet-kicker">Closet Item</p>
                        <h3>{getValue(attributes.category)}</h3>
                    </div>
                    <span className="cloud-closet-confidence">{confidence}</span>
                </div>

                {item.analysisStatus === 'failed' && item.analysisError && (
                    <p className="cloud-closet-card-error">{item.analysisError}</p>
                )}

                <div className="cloud-closet-attributes">
                    <AttributeRow label="Product Type" value={attributes.productType} />
                    <AttributeRow label="Material" value={attributes.material} />
                    <AttributeRow label="Fit" value={attributes.fit} />
                    <AttributeRow label="Occasion" value={attributes.occasion} />
                    <AttributeRow label="Season" value={attributes.season} />
                    <ChipList label="Colors" values={attributes.colors} />
                    <ChipList label="Style Tags" values={attributes.styleTags} />
                    <ChipList label="Keywords" values={attributes.keywords} />
                </div>

                <div className="cloud-closet-card-actions">
                    {onReanalyze && (
                        <button
                            type="button"
                            className="btn btn-outline cloud-closet-card-button"
                            onClick={() => onReanalyze(item._id)}
                            disabled={deleting || reanalyzing}
                        >
                            <RefreshCw size={16} />
                            {reanalyzing ? 'Retrying...' : 'Retry'}
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn btn-outline cloud-closet-card-button delete"
                        onClick={() => onDelete(item._id)}
                        disabled={deleting || reanalyzing}
                    >
                        <Trash2 size={16} />
                        {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </article>
    );
};

export default CloudClosetItemCard;
