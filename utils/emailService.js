const nodemailer = require('nodemailer');

// Create test account with Ethereal Email
let testAccount = null;
let transporter = null;

const createTestAccount = async () => {
    try {
        console.log('🔧 Creating Ethereal test account...');
        testAccount = await nodemailer.createTestAccount();

        console.log('✅ Ethereal test account created:');
        console.log('📧 Email:', testAccount.user);
        console.log('🔑 Password:', testAccount.pass);
        console.log('🌐 Web Interface:', 'https://ethereal.email');

        // Create transporter with test account
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });

        return testAccount;
    } catch (error) {
        console.error('❌ Failed to create Ethereal test account:', error);
        throw error;
    }
};

// Initialize transporter
const initializeTransporter = async () => {
    if (process.env.EMAIL_SERVICE === 'ethereal') {
        // Use Ethereal for testing
        if (!testAccount) {
            testAccount = await createTestAccount();
        }
    } else {
        // Use custom SMTP configuration
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }
};

// Initialize on module load
initializeTransporter();

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp, type = 'registration') => {
    try {
        // Ensure transporter is initialized
        if (!transporter) {
            await initializeTransporter();
        }

        console.log('=== SENDING EMAIL OTP ===');
        console.log('To:', email);
        console.log('OTP:', otp);
        console.log('Type:', type);

        const subject = type === 'registration' ? 'Verify Your Account - Printers App' : 'Reset Your Password - Printers App';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">Printers App</h1>
                    <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">${type === 'registration' ? 'Account Verification' : 'Password Reset'}</p>
                </div>
                <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h2 style="color: #333; margin-top: 0;">${type === 'registration' ? 'Verify Your Account' : 'Reset Your Password'}</h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.6;">Hello!</p>
                    <p style="color: #666; font-size: 16px; line-height: 1.6;">
                        ${type === 'registration' ? 'Thank you for registering with Printers App. Your OTP code is:' : 'We received a request to reset your password. Your OTP code is:'}
                    </p>
                    <div style="background-color: #f8f9fa; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                        <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</span>
                    </div>
                    <p style="color: #666; font-size: 14px; margin-bottom: 30px;">
                        This code will expire in <strong>10 minutes</strong>. Please use it to ${type === 'registration' ? 'verify your account' : 'reset your password'}.
                    </p>
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-top: 20px;">
                        <p style="color: #856404; margin: 0; font-size: 14px;">
                            <strong>Security Notice:</strong> If you didn't request this, please ignore this email. Your account remains secure.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="color: #999; font-size: 12px; margin: 0;">
                            This is an automated message from Printers App. Please do not reply to this email.
                        </p>
                    </div>
                </div>
            </div>
        `;

        const mailOptions = {
            from: `"Printers App" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: subject,
            html: html
        };

        console.log('📤 Sending email with options:', {
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject
        });

        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully!');
        console.log('📧 Message ID:', result.messageId);

        if (testAccount) {
            console.log('🌐 View email at:', nodemailer.getTestMessageUrl(result));
            console.log('🔗 Ethereal Web Interface: https://ethereal.email');
        }

        return result;
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        console.error('🔧 Full error details:', error);

        // For development, also log the OTP so we can test
        console.log('🔧 DEV MODE: OTP is:', otp, '- You can use this for testing if email fails');

        throw new Error(`Failed to send email: ${error.message}`);
    }
};;

module.exports = {
    generateOTP,
    sendOTPEmail
};