import design1 from '../../assets/designs/design1.png';
import design2 from '../../assets/designs/design2.png';
import design3 from '../../assets/designs/design3.png';
import design4 from '../../assets/designs/design4.png';

const TEMPLATE_ASSET_PATH = 'frontend/src/assets/templates/blacktee.svg';

const DESIGN_ASSETS = [
    {
        assetId: 'design1',
        label: 'Design 1',
        src: design1,
        imagePath: 'frontend/src/assets/designs/design1.png',
        aspectRatio: 2565 / 1583,
    },
    {
        assetId: 'design2',
        label: 'Design 2',
        src: design2,
        imagePath: 'frontend/src/assets/designs/design2.png',
        aspectRatio: 3117 / 1493,
    },
    {
        assetId: 'design3',
        label: 'Design 3',
        src: design3,
        imagePath: 'frontend/src/assets/designs/design3.png',
        aspectRatio: 1,
    },
    {
        assetId: 'design4',
        label: 'Design 4',
        src: design4,
        imagePath: 'frontend/src/assets/designs/design4.png',
        aspectRatio: 1,
    },
];

export { DESIGN_ASSETS, TEMPLATE_ASSET_PATH };
