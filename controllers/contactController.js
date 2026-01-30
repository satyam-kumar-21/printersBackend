const asyncHandler = require('express-async-handler');
const nodemailer = require('nodemailer');

// @desc    Send contact email
// @route   POST /api/contact
// @access  Public
const sendContactEmail = asyncHandler(async (req, res) => {
    const { name, email, orderNumber, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        res.status(400);
        throw new Error('Please fill in all required fields');
    }

    // Debugging logs
    console.log('EMAIL_SERVICE:', process.env.EMAIL_SERVICE);
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);

    // Configure the email transporter
    // Using host/port explicitly for better compatibility
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // Use SSL
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS?.replace(/"/g, ''), // Strip possible quotes
        },
    });

    const mailOptions = {
        from: email,
        to: process.env.CONTACT_RECEIVER_EMAIL, // The user's email
        subject: `Contact Form: ${subject} from ${name}`,
        text: `
            Name: ${name}
            Email: ${email}
            Order Number: ${orderNumber || 'N/A'}
            Subject: ${subject}
            
            Message:
            ${message}
        `,
        html: `
            <h3>New Contact Form Submission</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Order Number:</strong> ${orderNumber || 'N/A'}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <p>${message.replace(/\n/g, '<br>')}</p>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500);
        throw new Error('Failed to send email. Please try again later.');
    }
});

module.exports = { sendContactEmail };
