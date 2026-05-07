import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shirt, Sparkles } from 'lucide-react';
import CloudClosetItemCard from '../components/CloudClosetItemCard';
import CloudClosetUpload from '../components/CloudClosetUpload';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import '../styles/CloudClosetPage.css';

const DEFAULT_LIMIT_STATE = {
    limit: 2,
    count: 0,
    remaining: 2,
};

const CloudClosetPage = () => {
    const { userInfo } = useAuth();
    const [items, setItems] = useState([]);
    const [limitState, setLimitState] = useState(DEFAULT_LIMIT_STATE);
    const [loading, setLoading] = useState(Boolean(userInfo));
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [deletingId, setDeletingId] = useState('');
    const [reanalyzingId, setReanalyzingId] = useState('');

    const applyLimitState = (data) => {
        setLimitState({
            limit: Number(data.limit) || DEFAULT_LIMIT_STATE.limit,
            count: Number(data.count) || 0,
            remaining: Math.max(0, Number(data.remaining) || 0),
        });
    };

    const fetchCloudCloset = useCallback(async () => {
        if (!userInfo) {
            setItems([]);
            setLimitState(DEFAULT_LIMIT_STATE);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError('');
            const { data } = await api.get('/api/cloud-closet');
            setItems(Array.isArray(data.items) ? data.items : []);
            applyLimitState(data);
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    'Could not load your Cloud Closet right now.'
            );
        } finally {
            setLoading(false);
        }
    }, [userInfo]);

    useEffect(() => {
        fetchCloudCloset();
    }, [fetchCloudCloset]);

    const handleUpload = async (file) => {
        try {
            setUploading(true);
            setError('');
            setNotice('');

            const formData = new FormData();
            formData.append('image', file);

            const { data } = await api.post('/api/cloud-closet', formData);

            if (data.item) {
                setItems((currentItems) => [
                    data.item,
                    ...currentItems.filter((item) => item._id !== data.item._id),
                ]);
            }
            applyLimitState(data);
            setNotice(data.message || 'Cloud Closet item uploaded and analyzed.');
            return true;
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    'Could not upload that image. Please try another clothing photo.'
            );
            return false;
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (itemId) => {
        try {
            setDeletingId(itemId);
            setError('');
            setNotice('');

            const { data } = await api.delete(`/api/cloud-closet/${itemId}`);
            setItems((currentItems) => currentItems.filter((item) => item._id !== itemId));
            applyLimitState(data);
            setNotice(data.message || 'Cloud Closet item deleted.');
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    'Could not delete this Cloud Closet item.'
            );
        } finally {
            setDeletingId('');
        }
    };

    const handleReanalyze = async (itemId) => {
        try {
            setReanalyzingId(itemId);
            setError('');
            setNotice('');

            const { data } = await api.post(`/api/cloud-closet/${itemId}/reanalyze`);
            if (data.item) {
                setItems((currentItems) =>
                    currentItems.map((item) => (item._id === itemId ? data.item : item))
                );
            }
            setNotice(data.message || 'Cloud Closet item reanalyzed.');
        } catch (requestError) {
            const responseItem = requestError.response?.data?.item;
            if (responseItem) {
                setItems((currentItems) =>
                    currentItems.map((item) => (item._id === itemId ? responseItem : item))
                );
            }
            setError(
                requestError.response?.data?.message ||
                    'Could not reanalyze this Cloud Closet item.'
            );
        } finally {
            setReanalyzingId('');
        }
    };

    if (!userInfo) {
        return (
            <div className="cloud-closet-page container animate-fade-in">
                <section className="cloud-closet-hero glass">
                    <p className="cloud-closet-kicker">
                        <Sparkles size={16} /> Cloud Closet
                    </p>
                    <h1>Cloud Closet</h1>
                    <p>Upload clothes you own to improve your recommendations.</p>
                    <Link to="/login" className="btn btn-primary cloud-closet-login-link">
                        Sign In
                    </Link>
                </section>
            </div>
        );
    }

    return (
        <div className="cloud-closet-page container animate-fade-in">
            <section className="cloud-closet-hero glass">
                <div>
                    <p className="cloud-closet-kicker">
                        <Shirt size={16} /> Cloud Closet
                    </p>
                    <h1>Cloud Closet</h1>
                    <p>Upload clothes you own to improve your recommendations.</p>
                </div>
                <div className="cloud-closet-limit-pill">
                    {limitState.count}/{limitState.limit} uploaded
                </div>
            </section>

            {error && <p className="cloud-closet-message error">{error}</p>}
            {notice && <p className="cloud-closet-message success">{notice}</p>}

            <CloudClosetUpload
                count={limitState.count}
                limit={limitState.limit}
                uploading={uploading}
                onUpload={handleUpload}
            />

            {loading ? (
                <section className="cloud-closet-empty glass">
                    <Sparkles size={26} />
                    <h2>Loading your Cloud Closet...</h2>
                </section>
            ) : items.length === 0 ? (
                <section className="cloud-closet-empty glass">
                    <Shirt size={34} />
                    <h2>Your Cloud Closet is empty</h2>
                    <p>Add up to two clothing items you own to personalize fashion recommendations.</p>
                </section>
            ) : (
                <section className="cloud-closet-grid">
                    {items.map((item) => (
                        <CloudClosetItemCard
                            key={item._id}
                            item={item}
                            deleting={deletingId === item._id}
                            reanalyzing={reanalyzingId === item._id}
                            onDelete={handleDelete}
                            onReanalyze={handleReanalyze}
                        />
                    ))}
                </section>
            )}
        </div>
    );
};

export default CloudClosetPage;
