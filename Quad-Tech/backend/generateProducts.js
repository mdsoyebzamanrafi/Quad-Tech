import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const categories = [
    'Smartphones', 'Laptops', 'Wearables', 'Audio',
    'Gaming', 'Smart Home', 'Cameras', 'Tablets',
    'Accessories', 'Drones'
];

const adjectives = ['Pro', 'Elite', 'Max', 'Ultra', 'Plus', 'Lite', 'Mini', 'Gen 2', 'X', 'Neo'];
const bases = {
    'Smartphones': ['Phone', 'Communicator', 'Cellular', 'Device'],
    'Laptops': ['Book', 'Pad', 'Station', 'Rig'],
    'Wearables': ['Watch', 'Band', 'Tracker', 'Timepiece'],
    'Audio': ['Buds', 'Headphones', 'Speaker', 'Pods'],
    'Gaming': ['Console', 'Controller', 'Headset', 'Chair'],
    'Smart Home': ['Hub', 'Camera', 'Thermostat', 'Bulb'],
    'Cameras': ['Cam', 'Lens', 'Shooter', 'Action Cam'],
    'Tablets': ['Tab', 'Pad', 'Slate', 'Canvas'],
    'Accessories': ['Charger', 'Cable', 'Case', 'Stand'],
    'Drones': ['Flyer', 'Copter', 'Glider', 'Scout']
};

const defaultImages = {
    'Smartphones': 'https://images.unsplash.com/photo-1592890288564-76628a30a657?w=600&q=80',
    'Laptops': 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80',
    'Wearables': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80',
    'Audio': 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&q=80',
    'Gaming': 'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=600&q=80',
    'Smart Home': 'https://images.unsplash.com/photo-1558002038-1055907df827?w=600&q=80',
    'Cameras': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&q=80',
    'Tablets': 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80',
    'Accessories': 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&q=80',
    'Drones': 'https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=600&q=80'
};

const products = [];

categories.forEach(category => {
    for (let i = 0; i < 10; i++) {
        const baseWord = bases[category][Math.floor(Math.random() * bases[category].length)];
        const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const name = `Quad Tech ${baseWord} ${adjective}`;

        // Use LoremFlickr to get a relevant and unique image per product based on the category and an index lock
        const uniqueImage = `https://loremflickr.com/600/600/${encodeURIComponent(category.toLowerCase().split(' ')[0])}?lock=${Math.floor(Math.random() * 10000)}`;

        products.push({
            name: name,
            image: uniqueImage,
            description: `Experience the cutting-edge of ${category.toLowerCase()} technology with the luxurious ${name}. Designed by Quad Tech for peak performance.`,
            brand: 'Quad Tech',
            category: category,
            price: Number((Math.random() * (1500 - 50) + 50).toFixed(2)),
            countInStock: Math.floor(Math.random() * 50),
            rating: Number((Math.random() * (5 - 3.5) + 3.5).toFixed(1)),
            numReviews: Math.floor(Math.random() * 200) + 1,
        });
    }
});

const fileContent = `const products = ${JSON.stringify(products, null, 4)};\n\nexport default products;\n`;

const outputPath = path.join(__dirname, 'data', 'products.js');
fs.writeFileSync(outputPath, fileContent);
console.log('Successfully generated 100 products in data/products.js');
