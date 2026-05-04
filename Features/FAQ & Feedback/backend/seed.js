const mongoose = require('mongoose');
const FAQ = require('./Models/models_FAQ');
const CustomerFeedback = require('./models/CustomerFeedback');
const connectDB = require('./config/db');

const faqData = [
  { question: 'How do I place an order on Trail?', answer: 'Browse our catalog, add items to your cart, proceed to checkout, fill in shipping details, select payment method, and confirm. You will receive an order confirmation email.', category: 'Orders', order: 1 },
  { question: 'Can I order without creating an account?', answer: 'Yes, guest checkout is supported. However, creating an account lets you track orders, save addresses, and receive exclusive offers.', category: 'Orders', order: 2 },
  { question: 'How do I check my order status?', answer: 'Log into your account and visit "My Orders" or use the "Track Order" feature with your order ID and email. Real-time updates are sent via email and SMS.', category: 'Orders', order: 3 },
  { question: 'Can I cancel or modify my order after placing it?', answer: 'Orders can be modified or canceled within 1 hour of placement or before shipping. Once shipped, you can initiate a return after delivery.', category: 'Orders', order: 4 },
  { question: 'Why was my order canceled?', answer: 'Orders may be canceled due to payment failure, out-of-stock items, invalid address, suspected fraud, or customer request. You will receive an email with the reason.', category: 'Orders', order: 5 },
  { question: 'What payment methods are available?', answer: 'Credit/Debit Cards (Visa, Mastercard, Amex), Mobile Banking (bKash, Nagad, Rocket), Internet Banking, and Cash on Delivery (COD) for eligible orders.', category: 'Payments', order: 1 },
  { question: 'Do you support Cash on Delivery (COD)?', answer: 'Yes, COD is available within Dhaka and select cities. Minimum order value is BDT 500. Phone verification may be required.', category: 'Payments', order: 2 },
  { question: 'What should I do if my payment fails?', answer: 'Check your card balance and internet connection. Ensure your card is enabled for online transactions. Try an alternative payment method or contact your bank.', category: 'Payments', order: 3 },
  { question: 'Is it safe to pay online?', answer: 'Yes. Trail uses SSL encryption and PCI-DSS compliant gateways. Your card details are never stored on our servers. We offer 3D Secure authentication.', category: 'Payments', order: 4 },
  { question: 'Are there any hidden charges?', answer: 'No hidden charges. Delivery charges are calculated by location and shown at checkout. VAT is included in the product price.', category: 'Payments', order: 5 },
  { question: 'How long does delivery take?', answer: 'Dhaka City: 1-2 business days. Outside Dhaka: 3-5 business days. Remote areas: 5-7 business days. Express delivery available for select products.', category: 'Shipping & Delivery', order: 1 },
  { question: 'Do you deliver outside Dhaka?', answer: 'Yes, we deliver nationwide across Bangladesh. Free shipping on orders above BDT 2,000 outside Dhaka.', category: 'Shipping & Delivery', order: 2 },
  { question: 'How are delivery charges calculated?', answer: 'Based on location, package weight, and delivery speed. Dhaka: BDT 60-100. Outside Dhaka: BDT 120-200. Free shipping on orders above BDT 1,500 (Dhaka) or BDT 2,000 (outside).', category: 'Shipping & Delivery', order: 3 },
  { question: 'Can I track my order?', answer: 'Yes. Once shipped, you will receive a tracking number via email and SMS. Use it on our "Track Order" page or the courier website.', category: 'Shipping & Delivery', order: 4 },
  { question: 'What happens if I am not available during delivery?', answer: 'Our partner will attempt delivery up to 3 times. You can reschedule or pick up from the nearest courier office. After 3 failed attempts, the order is returned.', category: 'Shipping & Delivery', order: 5 },
  { question: 'What is your return policy?', answer: '7-day return policy for most items. Products must be unused with original packaging. Electronics have a 3-day window. Refunds processed within 5-10 business days.', category: 'Returns & Refunds', order: 1 },
  { question: 'How do I return a product?', answer: 'Go to "My Orders", select the order, click "Return Item", choose reason and refund method, pack securely, and our courier will pick it up.', category: 'Returns & Refunds', order: 2 },
  { question: 'How long does it take to get a refund?', answer: '5-10 business days after we receive the item. Mobile banking: 1-3 days. Card refunds: 5-10 days. COD refunds: 7 days via bank transfer.', category: 'Returns & Refunds', order: 3 },
  { question: 'Can I exchange a product instead of returning it?', answer: 'Yes, for size/color variations of the same product, subject to stock. Requests must be within 3 days of delivery.', category: 'Returns & Refunds', order: 4 },
  { question: 'Which products are non-returnable?', answer: 'Intimate wear, personalized products, perishables, digital products, gift cards, "Final Sale" items, and products with broken seals.', category: 'Returns & Refunds', order: 5 },
  { question: 'Are the products authentic/original?', answer: 'Yes, all products are 100% authentic, sourced from authorized distributors. Zero tolerance for counterfeit goods.', category: 'Products', order: 1 },
  { question: 'Will I receive the exact product shown?', answer: 'Yes, images and descriptions are accurate. Minor packaging changes may occur but specifications remain identical.', category: 'Products', order: 2 },
  { question: 'What if I receive a damaged or wrong product?', answer: 'Do not use the item. Take photos and contact us within 24 hours. We will arrange free return pickup and replacement or refund.', category: 'Products', order: 3 },
  { question: 'Do you restock sold-out items?', answer: 'Yes, popular items are restocked regularly. Click "Notify Me" on the product page. Local: 1-2 weeks. Imported: 3-4 weeks.', category: 'Products', order: 4 },
  { question: 'Can I request more product details?', answer: 'Yes, click "Ask a Question" on the product page or contact support for detailed specs and comparisons.', category: 'Products', order: 5 },
  { question: 'How do I create an account?', answer: 'Click "Sign Up", enter email and password, verify via confirmation link, and complete your profile. Or sign up with Google.', category: 'Account & Security', order: 1 },
  { question: 'I forgot my password—what should I do?', answer: 'Click "Forgot Password", enter your email, and we will send a reset link valid for 1 hour. Check spam if not received.', category: 'Account & Security', order: 2 },
  { question: 'How do I update my account details?', answer: 'Go to "My Account" > "Profile Settings". Update name, email, phone, password, and addresses. Email changes require verification.', category: 'Account & Security', order: 3 },
  { question: 'Is my personal information secure?', answer: 'Yes. We use AES-256 encryption, comply with GDPR, and never sell your data. See our Privacy Policy for details.', category: 'Account & Security', order: 4 },
  { question: 'Can I delete my account?', answer: 'Yes, contact support to request deletion. We verify identity and process within 30 days. Order history is retained but anonymized.', category: 'Account & Security', order: 5 },
  { question: 'How can I contact customer support?', answer: 'Live Chat (fastest), Email: support@trail.com, Phone: +880-1234-567890, WhatsApp: +880-1234-567891, or Social Media DMs.', category: 'Support', order: 1 },
  { question: 'What are your support hours?', answer: 'Saturday-Thursday: 9:00 AM - 9:00 PM (BST). Email is monitored 24/7 with responses within 4 hours during business hours.', category: 'Support', order: 2 },
  { question: 'How long does it take to get a response?', answer: 'Live Chat: instant. WhatsApp: within 15 min. Phone: immediate during hours. Email: within 4 hours (business hours).', category: 'Support', order: 3 },
  { question: 'Do you provide phone or WhatsApp support?', answer: 'Yes. Phone: +880-1234-567890. WhatsApp: +880-1234-567891. Both available Sat-Thu, 9 AM - 9 PM.', category: 'Support', order: 4 }
];

const sampleFeedback = [
  { name: 'Rahul Ahmed', email: 'rahul.ahmed@email.com', rating: 5, message: 'Excellent service! My order arrived within 24 hours in perfect condition. The packaging was premium and the product exceeded my expectations. Will definitely shop here again.', isApproved: true, isFeatured: true },
  { name: 'Fatima Khan', email: 'fatima.khan@email.com', rating: 4, message: 'Great experience overall. The website is easy to navigate and checkout was smooth. Delivery was prompt. Only suggestion is to add more payment options like EMI.', isApproved: true, isFeatured: true },
  { name: 'Tanvir Hassan', email: 'tanvir.h@email.com', rating: 5, message: 'Best e-commerce platform in Bangladesh! The customer support team helped me track my order and resolved my query within minutes. Highly recommended!', isApproved: true, isFeatured: true },
  { name: 'Nusrat Jahan', email: 'nusrat.j@email.com', rating: 3, message: 'Product quality is good but delivery took 4 days instead of the promised 2 days. Would appreciate better communication regarding delays.', isApproved: true, isFeatured: false },
  { name: 'Imran Hossain', email: 'imran.h@email.com', rating: 5, message: 'The return process was incredibly smooth. I received my refund within 3 days. Trail really cares about customer satisfaction. Keep up the great work!', isApproved: true, isFeatured: true },
  { name: 'Sarah Islam', email: 'sarah.i@email.com', rating: 4, message: 'Love the variety of products available. Prices are competitive and the flash sales are amazing. Would love to see more international brands added.', isApproved: true, isFeatured: false }
];

const seedDatabase = async () => {
  try {
    await connectDB();
    await FAQ.deleteMany({});
    await CustomerFeedback.deleteMany({});
    await FAQ.insertMany(faqData);
    console.log(`Seeded ${faqData.length} FAQs`);
    const feedbackWithIP = sampleFeedback.map(f => ({ ...f, ipAddress: '127.0.0.1', userAgent: 'Seed Script' }));
    await CustomerFeedback.insertMany(feedbackWithIP);
    console.log(`Seeded ${sampleFeedback.length} feedback entries`);
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();