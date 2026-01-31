const asyncHandler = require('express-async-handler');
const nodemailer = require('nodemailer');

// @desc    Send contact email
// @route   POST /api/contact
// @access  Public
const sendContactEmail = asyncHandler(async (req, res) => {
    const { name, email, orderNumber, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
        res.status(400);
        throw new Error('Please fill in all required fields');
    }

    // Debug logs (optional)
    console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASS length:', process.env.EMAIL_PASS?.length || 0);

    // Configure Nodemailer transporter for cPanel webmail
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT),         // 465 for SSL
        secure: process.env.EMAIL_SECURE === 'true',  // true for SSL
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    // Verify SMTP connection (optional but recommended)
    try {
        await transporter.verify();
        console.log('✅ SMTP connected successfully');
    } catch (err) {
        console.error('SMTP connection error:', err);
        res.status(500);
        throw new Error('Email server connection failed');
    }

    // Prepare email content
    const mailOptions = {
        from: `"${name}" <${process.env.EMAIL_FROM}>`,  // Professional sender
        to: process.env.CONTACT_RECEIVER_EMAIL,         // Your email
        replyTo: email,                                 // User reply goes to their email
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

    // Send email
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
