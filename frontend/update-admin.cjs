const fs = require('fs');
const files = [
    'src/pages/admin/AdminUserDetailsPage.jsx',
    'src/pages/admin/CouponListPage.jsx',
    'src/pages/admin/SalesDashboardPage.jsx',
    'src/pages/admin/AdminProductsPage.jsx',
    'src/pages/admin/AdminOrdersPage.jsx',
    'src/pages/admin/AdminOrderDetailsPage.jsx'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // 1. Remove formatMoney from adminUtils import. 
    // It's safer to use regex that matches `formatMoney, ` or `, formatMoney` or just `formatMoney`
    content = content.replace(/,\s*formatMoney/g, '');
    content = content.replace(/formatMoney,\s*/g, '');
    
    // 2. Add useCurrency import if not present
    if (!content.includes('import { useCurrency }')) {
        // Find the first import and add it before it.
        content = "import { useCurrency } from '../../context/CurrencyContext';\n" + content;
    }

    // 3. Add const { formatCurrency } = useCurrency();
    if (!content.includes('const { formatCurrency } = useCurrency();')) {
        // find a good place inside component
        content = content.replace(/(const [a-zA-Z0-9]+ = \([^{]*\) => {)/, "$1\n    const { formatCurrency } = useCurrency();");
    }

    // 4. replace formatMoney( with formatCurrency(
    content = content.replace(/formatMoney\(/g, 'formatCurrency(');

    fs.writeFileSync(file, content);
});

// For adminUtils.js
let adminUtils = fs.readFileSync('src/utils/adminUtils.js', 'utf8');
adminUtils = adminUtils.replace(/export const formatMoney = [\s\S]*?};\n/, '');
fs.writeFileSync('src/utils/adminUtils.js', adminUtils);

console.log('Admin pages updated');
