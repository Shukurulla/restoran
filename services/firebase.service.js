const admin = require("firebase-admin");

let isInitialized = false;

// Firebase Admin SDK'ni initialize qilish
function initializeFirebase() {
  if (isInitialized) return;

  try {
    // Service account credentials - environment variables dan olish
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url:
        "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CERT_URL,
    };

    // Agar credentials mavjud bo'lsa
    if (
      serviceAccount.project_id &&
      serviceAccount.private_key &&
      serviceAccount.client_email
    ) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      isInitialized = true;
      console.log("Firebase Admin SDK initialized successfully");
    } else {
      console.log(
        "Firebase Admin SDK credentials not found - push notifications disabled"
      );
    }
  } catch (error) {
    console.error("Firebase Admin SDK initialization error:", error);
  }
}

// Push notification yuborish
async function sendPushNotification(fcmToken, title, body, data = {}) {
  if (!isInitialized) {
    console.log("Firebase not initialized - skipping push notification");
    return null;
  }

  if (!fcmToken) {
    console.log("No FCM token provided - skipping push notification");
    return null;
  }

  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "waiter_high_priority",
          priority: "high",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log(`Push notification sent successfully: ${response}`);
    return response;
  } catch (error) {
    console.error("Error sending push notification:", error);
    // Token yaroqsiz bo'lsa
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      console.log("Invalid FCM token - should be removed from database");
      return { error: "invalid_token" };
    }
    return null;
  }
}

// Bir nechta tokenlarga push notification yuborish
async function sendPushNotificationToMultiple(fcmTokens, title, body, data = {}) {
  if (!isInitialized) {
    console.log("Firebase not initialized - skipping push notification");
    return null;
  }

  const validTokens = fcmTokens.filter((token) => token && token.length > 0);
  if (validTokens.length === 0) {
    console.log("No valid FCM tokens provided - skipping push notification");
    return null;
  }

  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "waiter_high_priority",
          priority: "high",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
      tokens: validTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(
      `Push notifications sent: ${response.successCount} success, ${response.failureCount} failed`
    );
    return response;
  } catch (error) {
    console.error("Error sending push notifications:", error);
    return null;
  }
}

module.exports = {
  initializeFirebase,
  sendPushNotification,
  sendPushNotificationToMultiple,
};
