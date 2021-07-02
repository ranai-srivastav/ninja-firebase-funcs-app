/* eslint-disable no-multi-spaces */
/* eslint-disable max-len */

const functions = require("firebase-functions");    // firebase functions: Gives access to functions
const admin = require("firebase-admin");            // firebase admin: WHAT EXACTLY IS THIS USED FOR (Used to access things in the database)
admin.initializeApp();

// auth trigger on new user signp. AUtomatic function
exports.newUserSignup = functions.auth.user().onCreate((user) => {
  // console.log("user created", user.email, user.uid);
  return admin.firestore().collection("users").doc(user.uid).set({  // promise
    email: user.email,
    upvotedOn: [],
  });
});

// automatic function that gets called when a a user is deleted.
// This functions uses the admin sdk to access a collection and delete the corresponding doc
// when a user account is deleted from auth
exports.userDeleted = functions.auth.user().onDelete((user) => {
  // console.log("user deleted", user.email, user.uid);
  const doc = admin.firestore().collection("users").doc(user.uid);
  return doc.delete();
});

// http callable function. Called using the functions library
exports.addRequest = functions.https.onCall((data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(           // throws a https error. Theres a list of google given codes.
        "unauthenticated",                          // The first one is the google code and the second one
        "Only authenticated users can add requests" // is generated message accessible through error.message
    );
  }

  if (data.text.length > 30) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "request must be no more than 30 chars long"
    );
  }

  return admin.firestore().collection("requests").add({
    text: data.text,
    upvote: 0,
  });
});

// data object will be given by whatever calls. It has an id proprty of the request we want to update. Look at vue code in requests.js
exports.upvote = functions.https.onCall( (data, cont) => {
  if (!cont.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Only authenticated users can add requests"
    );
  }

  // getting the references                                                         // HOW DOES THIS FUNCTION HAVE MULTIPLE RETURN STATEMENTS. WHY?
  const user = admin.firestore().collection("users").doc(cont.auth.uid);
  const request = admin.firestore().collection("requests").doc(data.id);


  // checking doble upvotes. If the list of users upvoted documents has the document if of the document
  // that this function was called on, then BAD
  return user.get().then((doc) => {
    if (doc.data().upvotedOn.includes(data.id)) {
      throw new functions.https.HttpsError(
          "failed-precondition",
          "You can only upvote once"
      );
    }

    return user.update({
      upvotedOn: [...doc.data().upvotedOn, data.id],    // What is ... operator? The spread operator
    }).then( () => {
      // update votes on the request
      return request.update({
        upvote: admin.firestore.FieldValue.increment(1),
      });
    });
  });
});

// // http request
// exports.randomNumber = functions.https.onRequest((req, res) => {
//   const number = Math.round(Math.random() * 100);
//   res.send(number.toString());
// });

// exports.toTheDojo = functions.https.onRequest((req, res) => {
//   res.redirect("https://ranaisrivastav.wixsite.com/aboutme");
// });

// // http callable
// exports.sayHello = functions.https.onCall((data, context) => {
//   const name = data.name;

//   return `Hello, ${name}`;
// });

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

/**
exports.addMessage = functions.https.onRequest(async (req, res) => {
  // Grab the text parameter.
  const original = req.query.text;
  // Push the new message into Firestore using the Firebase Admin SDK.
  const writeResult = await admin.firestore().collection('messages').add({original: original});
  // Send back a message that we've successfully written the message
  res.json({result: `Message with ID: ${writeResult.id} added.`});
});

// Listens for new messages added to /messages/:documentId/original and creates an
// uppercase version of the message to /messages/:documentId/uppercase
exports.makeUppercase = functions.firestore.document('/messages/{documentId}')
    .onCreate((snap, context) => {
      // Grab the current value of what was written to Firestore.
      const original = snap.data().original;

      // Access the parameter `{documentId}` with `context.params`
      functions.logger.log('Uppercasing', context.params.documentId, original);

      const uppercase = original.toUpperCase();

      // You must return a Promise when performing asynchronous tasks inside a Functions such as
      // writing to Firestore.
      // Setting an 'uppercase' field in Firestore document returns a Promise.
      return snap.ref.set({uppercase}, {merge: true});
    });
    **/
