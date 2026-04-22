const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// Configure Nodemailer with Gmail SMTP
// Note: We use Firebase Config variables to keep credentials secure.
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: functions.config().email.user,
        pass: functions.config().email.pass, // MUST use Gmail App Password
    },
});

/**
 * TRIGGER 1: New Payment Email Notification
 * Fires when a new document is added to the payments collection.
 */
exports.sendPaymentEmail = functions.firestore
    .document("artifacts/{appId}/users/{userId}/payments/{paymentId}")
    .onCreate(async (snap, context) => {
        const payment = snap.data();

        // Ensure this is a valid Client Payment and an email address exists
        if (payment.type !== "Payment" || !payment.clientEmail) {
            console.log("Skipping email: Not a client payment or missing email address.");
            return null;
        }

        const formattedAmount = new Intl.NumberFormat('en-NG', { 
            style: 'currency', 
            currency: 'NGN' 
        }).format(payment.amount);

        const mailOptions = {
            from: `"Cluster Synergy Limited" <${functions.config().email.user}>`,
            to: payment.clientEmail,
            subject: `Payment Received - Job ${payment.jobId}`,
            text: `Hello ${payment.clientName},\n\nWe have received your payment of ${formattedAmount}.\nShipment ID: ${payment.jobId}\n\nThank you for choosing Cluster Synergy Limited.`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #0c4a6e; padding: 20px; text-align: center; color: white;">
                        <h2 style="margin: 0;">Payment Receipt Acknowledged</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>Hello <strong>${payment.clientName}</strong>,</p>
                        <p>We successfully received your payment.</p>
                        <ul style="list-style-type: none; padding: 0; background: #f8fafc; padding: 15px; border-radius: 5px;">
                            <li><strong>Amount Paid:</strong> <span style="color: #059669; font-weight: bold;">${formattedAmount}</span></li>
                            <li><strong>Job ID / Reference:</strong> ${payment.jobId}</li>
                            <li><strong>Date:</strong> ${payment.date}</li>
                        </ul>
                        <p style="margin-top: 30px; font-size: 12px; color: #64748b;">Thank you for choosing Cluster Synergy Limited.</p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Payment email successfully sent to ${payment.clientEmail} for Job ${payment.jobId}`);
        } catch (error) {
            console.error("❌ Error sending payment email:", error);
        }

        return null;
    });

/**
 * TRIGGER 2: Shipment Status Update Email Notification
 * Fires when an existing shipment document is modified.
 */
exports.sendShipmentStatusEmail = functions.firestore
    .document("artifacts/{appId}/users/{userId}/shipments/{shipmentId}")
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        // Idempotency: Only send if the status ACTUALLY changed and email exists
        if (before.status === after.status || !after.clientEmail) {
            return null;
        }

        const mailOptions = {
            from: `"Cluster Synergy Limited" <${functions.config().email.user}>`,
            to: after.clientEmail,
            subject: `Shipment Status Update - ${after.jobId}`,
            text: `Hello ${after.clientName},\n\nYour shipment ${after.jobId} status has been updated to: [ ${after.status.toUpperCase()} ]\n\nThank you,\nCluster Synergy Limited`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #0284c7; padding: 20px; text-align: center; color: white;">
                        <h2 style="margin: 0;">Shipment Status Update</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>Hello <strong>${after.clientName}</strong>,</p>
                        <p>This is to notify you that the status of your shipment <strong>${after.jobId}</strong> has changed.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <span style="background-color: #e0f2fe; color: #0284c7; padding: 10px 20px; border-radius: 50px; font-weight: bold; font-size: 18px;">
                                ${after.status.toUpperCase()}
                            </span>
                        </div>
                        <p style="margin-top: 30px; font-size: 12px; color: #64748b;">Thank you for doing business with Cluster Synergy Limited.</p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Status update email sent to ${after.clientEmail} for Job ${after.jobId}`);
        } catch (error) {
            console.error("❌ Error sending status update email:", error);
        }

        return null;
    });