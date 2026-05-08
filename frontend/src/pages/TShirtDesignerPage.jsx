import React from 'react';
import { useParams } from 'react-router-dom';
import TShirtDesigner from '../components/designer/TShirtDesigner';

const TShirtDesignerPage = () => {
    const { id } = useParams();

    return <TShirtDesigner productId={id} />;
};

export default TShirtDesignerPage;
