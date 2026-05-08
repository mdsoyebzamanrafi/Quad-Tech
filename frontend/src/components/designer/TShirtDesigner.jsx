import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, RotateCw, ShoppingCart, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import { useCart } from '../../context/CartContext';
import blackTeeSvg from '../../assets/templates/blacktee.svg';
import ColorPicker from './ColorPicker';
import DesignToolbar from './DesignToolbar';
import { DESIGN_ASSETS, TEMPLATE_ASSET_PATH } from './designAssets';
import '../../styles/TShirtDesigner.css';

const TEMPLATE_SIZE = 2500;
const EXPORT_SIZE = 1200;
const DEFAULT_SHIRT_COLOR = '#ff0000';
const MIN_DESIGN_SIZE = 90;
const MAX_DESIGN_SIZE = 900;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(value);

const normalizeColorInput = (value) => {
    const nextValue = String(value || '').trim();
    return isHexColor(nextValue) ? nextValue : DEFAULT_SHIRT_COLOR;
};

const loadImage = (src) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });

const buildColoredSvgMarkup = (svgText, color) => {
    if (!svgText || typeof DOMParser === 'undefined') {
        return '';
    }

    const parser = new DOMParser();
    const documentNode = parser.parseFromString(svgText, 'image/svg+xml');
    documentNode.querySelectorAll('.shirt-base').forEach((path) => {
        path.setAttribute('fill', color);
    });

    return new XMLSerializer().serializeToString(documentNode.documentElement);
};

const TShirtDesigner = ({ productId }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { addToCart } = useCart();
    const surfaceRef = useRef(null);
    const interactionRef = useRef(null);

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [svgText, setSvgText] = useState('');
    const [shirtColor, setShirtColor] = useState(DEFAULT_SHIRT_COLOR);
    const [designs, setDesigns] = useState([]);
    const [activeDesignId, setActiveDesignId] = useState(null);
    const [selectedSize, setSelectedSize] = useState(location.state?.selectedSize || '');
    const [qty, setQty] = useState(Number(location.state?.qty) || 1);
    const [saving, setSaving] = useState(false);

    const assetMap = useMemo(
        () => new Map(DESIGN_ASSETS.map((asset) => [asset.assetId, asset])),
        []
    );

    const coloredSvgMarkup = useMemo(
        () => buildColoredSvgMarkup(svgText, shirtColor),
        [shirtColor, svgText]
    );

    useEffect(() => {
        let cancelled = false;

        const loadProduct = async () => {
            setLoading(true);
            setError('');

            try {
                const [{ data }, svgResponse] = await Promise.all([
                    api.get(`/api/products/${productId}`),
                    fetch(blackTeeSvg),
                ]);

                if (cancelled) {
                    return;
                }

                setProduct(data);
                setSvgText(await svgResponse.text());

                setSelectedSize((currentSize) =>
                    currentSize || (Array.isArray(data.sizes) && data.sizes.length > 0 ? data.sizes[0] : '')
                );
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError.response?.data?.message || loadError.message || 'Designer could not load.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadProduct();

        return () => {
            cancelled = true;
        };
    }, [productId]);

    const getCanvasPoint = useCallback((clientX, clientY) => {
        const surface = surfaceRef.current;
        if (!surface) {
            return { x: 0, y: 0 };
        }

        const rect = surface.getBoundingClientRect();
        return {
            x: clamp(((clientX - rect.left) / rect.width) * TEMPLATE_SIZE, 0, TEMPLATE_SIZE),
            y: clamp(((clientY - rect.top) / rect.height) * TEMPLATE_SIZE, 0, TEMPLATE_SIZE),
        };
    }, []);

    const addDesign = useCallback((assetId, point = null) => {
        const asset = assetMap.get(assetId);
        if (!asset) {
            return;
        }

        const width = asset.aspectRatio > 1.5 ? 360 : 290;
        const height = width / asset.aspectRatio;
        const placement = point || { x: 640, y: 1160 };
        const id = `${assetId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

        const nextDesign = {
            id,
            assetId,
            x: clamp(placement.x - width / 2, 0, TEMPLATE_SIZE - width),
            y: clamp(placement.y - height / 2, 0, TEMPLATE_SIZE - height),
            width,
            height,
            rotation: 0,
            zIndex: designs.length + 1,
        };

        setDesigns((currentDesigns) => [...currentDesigns, nextDesign]);
        setActiveDesignId(id);
    }, [assetMap, designs.length]);

    const deleteDesign = useCallback((designId) => {
        if (!designId) {
            return;
        }

        setDesigns((currentDesigns) => currentDesigns.filter((design) => design.id !== designId));
        setActiveDesignId((currentId) => (currentId === designId ? null : currentId));
    }, []);

    const startInteraction = useCallback((event, designId, type) => {
        const design = designs.find((item) => item.id === designId);
        if (!design) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const point = getCanvasPoint(event.clientX, event.clientY);
        const centerX = design.x + design.width / 2;
        const centerY = design.y + design.height / 2;

        interactionRef.current = {
            type,
            designId,
            offsetX: point.x - design.x,
            offsetY: point.y - design.y,
            centerX,
            centerY,
            aspectRatio: design.width / design.height,
            startRotation: design.rotation,
            startAngle: Math.atan2(point.y - centerY, point.x - centerX) * (180 / Math.PI),
        };

        setActiveDesignId(designId);
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }, [designs, getCanvasPoint]);

    useEffect(() => {
        const handlePointerMove = (event) => {
            const interaction = interactionRef.current;
            if (!interaction) {
                return;
            }

            const point = getCanvasPoint(event.clientX, event.clientY);

            setDesigns((currentDesigns) =>
                currentDesigns.map((design) => {
                    if (design.id !== interaction.designId) {
                        return design;
                    }

                    if (interaction.type === 'move') {
                        return {
                            ...design,
                            x: clamp(point.x - interaction.offsetX, 0, TEMPLATE_SIZE - design.width),
                            y: clamp(point.y - interaction.offsetY, 0, TEMPLATE_SIZE - design.height),
                        };
                    }

                    if (interaction.type === 'resize') {
                        const distance = Math.hypot(point.x - interaction.centerX, point.y - interaction.centerY);
                        const width = clamp(
                            (distance * 2) / Math.sqrt(1 + 1 / (interaction.aspectRatio * interaction.aspectRatio)),
                            MIN_DESIGN_SIZE,
                            MAX_DESIGN_SIZE
                        );
                        const height = width / interaction.aspectRatio;

                        return {
                            ...design,
                            width,
                            height,
                            x: clamp(interaction.centerX - width / 2, 0, TEMPLATE_SIZE - width),
                            y: clamp(interaction.centerY - height / 2, 0, TEMPLATE_SIZE - height),
                        };
                    }

                    if (interaction.type === 'rotate') {
                        const nextAngle = Math.atan2(point.y - interaction.centerY, point.x - interaction.centerX) * (180 / Math.PI);
                        return {
                            ...design,
                            rotation: interaction.startRotation + nextAngle - interaction.startAngle,
                        };
                    }

                    return design;
                })
            );
        };

        const stopInteraction = () => {
            interactionRef.current = null;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopInteraction);
        window.addEventListener('pointercancel', stopInteraction);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', stopInteraction);
            window.removeEventListener('pointercancel', stopInteraction);
        };
    }, [getCanvasPoint]);

    const exportPreviewImage = useCallback(async () => {
        const svgMarkup = coloredSvgMarkup || buildColoredSvgMarkup(svgText, shirtColor);
        const canvas = document.createElement('canvas');
        canvas.width = EXPORT_SIZE;
        canvas.height = EXPORT_SIZE;

        const context = canvas.getContext('2d');
        const scale = EXPORT_SIZE / TEMPLATE_SIZE;
        const svgUrl = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' }));

        try {
            const shirtImage = await loadImage(svgUrl);
            context.drawImage(shirtImage, 0, 0, EXPORT_SIZE, EXPORT_SIZE);

            const orderedDesigns = [...designs].sort((a, b) => a.zIndex - b.zIndex);

            for (const design of orderedDesigns) {
                const asset = assetMap.get(design.assetId);
                if (!asset) {
                    continue;
                }

                const image = await loadImage(asset.src);
                context.save();
                context.translate((design.x + design.width / 2) * scale, (design.y + design.height / 2) * scale);
                context.rotate((design.rotation * Math.PI) / 180);
                context.drawImage(
                    image,
                    -(design.width * scale) / 2,
                    -(design.height * scale) / 2,
                    design.width * scale,
                    design.height * scale
                );
                context.restore();
            }

            return canvas.toDataURL('image/png');
        } finally {
            URL.revokeObjectURL(svgUrl);
        }
    }, [assetMap, coloredSvgMarkup, designs, shirtColor, svgText]);

    const serializeDesigns = useCallback(() =>
        [...designs]
            .sort((a, b) => a.zIndex - b.zIndex)
            .map((design, index) => {
                const asset = assetMap.get(design.assetId);
                return {
                    assetId: design.assetId,
                    imagePath: asset?.imagePath || '',
                    x: Math.round(design.x),
                    y: Math.round(design.y),
                    width: Math.round(design.width),
                    height: Math.round(design.height),
                    rotation: Math.round(design.rotation * 10) / 10,
                    zIndex: index + 1,
                };
            }), [assetMap, designs]);

    const addToCartHandler = async () => {
        if (!product || saving) {
            return;
        }

        setSaving(true);

        try {
            const previewImageUrl = await exportPreviewImage();
            const customDesign = {
                designId: `blacktee-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
                shirtColor,
                templateId: 'blacktee',
                templatePath: TEMPLATE_ASSET_PATH,
                previewImageUrl,
                designs: serializeDesigns(),
            };

            await addToCart(product._id, qty, {
                selectedColor: shirtColor,
                selectedSize,
                customDesign,
            });
            navigate('/cart');
        } catch (saveError) {
            setError(saveError.message || 'Could not add this custom shirt to cart.');
        } finally {
            setSaving(false);
        }
    };

    const discardDesign = () => {
        setShirtColor(DEFAULT_SHIRT_COLOR);
        setDesigns([]);
        setActiveDesignId(null);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        const assetId = event.dataTransfer.getData('text/plain');
        if (!assetId) {
            return;
        }

        addDesign(assetId, getCanvasPoint(event.clientX, event.clientY));
    };

    if (loading) {
        return <div className="designer-page container animate-fade-in">Loading designer...</div>;
    }

    if (error && !product) {
        return (
            <div className="designer-page container animate-fade-in">
                <div className="designer-error glass">{error}</div>
            </div>
        );
    }

    const maxQty = Math.max(Number(product?.countInStock || 0), 1);
    const sizes = Array.isArray(product?.sizes) ? product.sizes.filter(Boolean) : [];

    return (
        <div className="designer-page container animate-fade-in">
            <div className="designer-header">
                <Link to={`/product/${productId}`} className="btn btn-outline">
                    <ArrowLeft size={17} />
                    Product
                </Link>
                <div>
                    <p>{product?.brand}</p>
                    <h1>Customize {product?.name}</h1>
                </div>
            </div>

            {error && <div className="designer-error glass">{error}</div>}

            <div className="designer-layout">
                <main className="designer-stage-panel glass">
                    <div
                        ref={surfaceRef}
                        className="designer-surface"
                        onPointerDown={() => setActiveDesignId(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={handleDrop}
                    >
                        {coloredSvgMarkup && (
                            <div
                                className="designer-shirt-svg"
                                dangerouslySetInnerHTML={{ __html: coloredSvgMarkup }}
                            />
                        )}

                        {designs.map((design) => {
                            const asset = assetMap.get(design.assetId);
                            const isActive = activeDesignId === design.id;

                            return (
                                <div
                                    key={design.id}
                                    className={`designer-placed-design ${isActive ? 'active' : ''}`}
                                    style={{
                                        left: `${(design.x / TEMPLATE_SIZE) * 100}%`,
                                        top: `${(design.y / TEMPLATE_SIZE) * 100}%`,
                                        width: `${(design.width / TEMPLATE_SIZE) * 100}%`,
                                        height: `${(design.height / TEMPLATE_SIZE) * 100}%`,
                                        transform: `rotate(${design.rotation}deg)`,
                                        zIndex: 10 + design.zIndex,
                                    }}
                                    onPointerDown={(event) => startInteraction(event, design.id, 'move')}
                                >
                                    <img src={asset?.src} alt={asset?.label || 'Design'} draggable="false" />

                                    {isActive && (
                                        <>
                                            <button
                                                type="button"
                                                className="designer-control designer-delete-control"
                                                onPointerDown={(event) => event.stopPropagation()}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    deleteDesign(design.id);
                                                }}
                                                aria-label="Remove design"
                                                title="Remove"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                className="designer-control designer-rotate-control"
                                                onPointerDown={(event) => startInteraction(event, design.id, 'rotate')}
                                                aria-label="Rotate design"
                                                title="Rotate"
                                            >
                                                <RotateCw size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                className="designer-resize-control"
                                                onPointerDown={(event) => startInteraction(event, design.id, 'resize')}
                                                aria-label="Resize design"
                                                title="Resize"
                                            />
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </main>

                <aside className="designer-sidebar glass">
                    <ColorPicker
                        value={shirtColor}
                        onChange={(value) => setShirtColor(normalizeColorInput(value))}
                    />

                    <DesignToolbar
                        activeDesignId={activeDesignId}
                        onAddDesign={addDesign}
                        onDeleteDesign={deleteDesign}
                    />

                    {sizes.length > 0 && (
                        <div className="designer-sidebar-section">
                            <label className="designer-field-label" htmlFor="designer-size">Size</label>
                            <select
                                id="designer-size"
                                className="designer-select"
                                value={selectedSize}
                                onChange={(event) => setSelectedSize(event.target.value)}
                            >
                                {sizes.map((size) => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="designer-sidebar-section">
                        <label className="designer-field-label" htmlFor="designer-qty">Quantity</label>
                        <select
                            id="designer-qty"
                            className="designer-select"
                            value={qty}
                            onChange={(event) => setQty(Number(event.target.value))}
                        >
                            {[...Array(maxQty).keys()].map((value) => (
                                <option key={value + 1} value={value + 1}>{value + 1}</option>
                            ))}
                        </select>
                    </div>

                    <div className="designer-actions">
                        <button
                            type="button"
                            className="btn btn-primary btn-full"
                            onClick={addToCartHandler}
                            disabled={saving || Number(product?.countInStock || 0) <= 0}
                        >
                            <ShoppingCart size={19} />
                            {saving ? 'Adding...' : 'Add To Cart'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary btn-full"
                            onClick={discardDesign}
                            disabled={saving}
                        >
                            <RotateCcw size={18} />
                            Discard Design
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default TShirtDesigner;
