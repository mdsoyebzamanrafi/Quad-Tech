import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
    // Basic SMTP Configuration for development or production
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_PORT == 465, // true for 465
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        connectionTimeout: 10000, // 10 seconds
    });

    const message = {
        from: `${process.env.SMTP_FROM_NAME || 'Tiger Tech'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: options.email,
        subject: options.subject,
        html: options.message,
    };

    const info = await transporter.sendMail(message);

    console.log('Message sent: %s', info.messageId);
};

export default sendEmail;
