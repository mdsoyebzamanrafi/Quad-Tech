import React from 'react';
import { Trash2 } from 'lucide-react';
import { DESIGN_ASSETS } from './designAssets';

const DesignToolbar = ({ activeDesignId, onAddDesign, onDeleteDesign }) => (
    <div className="designer-sidebar-section">
        <div className="designer-section-heading">
            <span>Designs</span>
            <strong>{DESIGN_ASSETS.length}</strong>
        </div>

        <div className="designer-thumbnail-grid">
            {DESIGN_ASSETS.map((design) => (
                <button
                    key={design.assetId}
                    type="button"
                    className="designer-thumbnail-button"
                    onClick={() => onAddDesign(design.assetId)}
                    draggable
                    onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', design.assetId);
                        event.dataTransfer.effectAllowed = 'copy';
                    }}
                    title={`Add ${design.label}`}
                >
                    <img src={design.src} alt={design.label} draggable="false" />
                </button>
            ))}
        </div>

        <button
            type="button"
            className="designer-icon-action"
            onClick={() => onDeleteDesign(activeDesignId)}
            disabled={!activeDesignId}
        >
            <Trash2 size={17} />
            Remove Selected
        </button>
    </div>
);

export default DesignToolbar;
