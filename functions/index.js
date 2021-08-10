/* eslint-disable prefer-const */
/* eslint-disable no-multi-spaces */
/* eslint-disable max-len */

const functions = require("firebase-functions");    // firebase functions: Gives access to functions
const admin = require("firebase-admin");            // firebase admin: WHAT EXACTLY IS THIS USED FOR (Used to access things in the database)
const google = require("googleapis");
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: "www.google.com",
});

//  client id 796261607594-02v08li2ac9sh36lrqs0t6aqilonn21m.apps.googleusercontent.com
const serviceAccount = require("./ninja-cloud-funcs-9fe67-firebase-adminsdk-tuoig-cfd97fe834.json");

const scopes = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/firebase.database",
];

const jwtClient = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    scopes,
);

jwtClient.authorize( (error, tokens) => {
  if (error) {
    console.log("Error making request to generate access token:", error);
  } else if (tokens.access_token === null) {
    console.log("Provided service account does not have permission to generate access tokens");
  } else {
    const accessToken = tokens.access_token;
    console.log(accessToken);
  }
});

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
        "Only authenticated users can add requests", // is generated message accessible through error.message
    );
  }

  if (data.text.length > 30) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "request must be no more than 30 chars long",
    );
  }

  return admin.firestore().collection("requests").add({
    text: data.text,
    upvote: 0,
  });
});

exports.upvote = functions.https.onCall(async (data, context) => {
  // check auth state
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "only authenticated users can vote up requests",
    );
  }
  // get refs for user doc & request doc
  const user = admin.firestore().collection("users").doc(context.auth.uid);
  const request = admin.firestore().collection("requests").doc(data.id);

  const doc = await user.get();

  // check thew user hasn't already upvoted
  if (doc.data().upvotedOn.includes(data.id)) {
    throw new functions.https.HttpsError(
        "failed-precondition",
        "You can only vote something up once",
    );
  }

  // update the array in user document
  await user.update({
    upvotedOn: [...doc.data().upvotedOn, data.id],
  });

  // update the votes on the request
  return request.update({
    upvote: admin.firestore.FieldValue.increment(1),
  });
});

// data object will be given by whatever calls. It has an id proprty of the request we want to update. Look at vue code in requests.js
exports.upvote = functions.https.onCall( (data, cont) => {
  if (!cont.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "Only authenticated users can add requests",
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
          "You can only upvote once",
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

// http request
exports.randomNumber = functions.https.onRequest((req, res) => {
  const number = Math.round(Math.random() * 100);
  res.send(number.toString());
});

exports.toTheDojo = functions.https.onRequest((req, res) => {
  res.redirect("https://ranaisrivastav.wixsite.com/aboutme");
});

exports.httpsRequest = functions.https.onRequest((req, res) => {
  const tokenId = req.get("auth_token");
  if (tokenId) {
    console.log("WHOA");
  }

  const tut = req.query.text;
  console.log(tut);
  const db = admin.firestore().collection("requests");

  let requests = [];
  return db.where("text", "==", tut).get().then((docs) => { // if bad query, there is no docs in requests. Check size of requests[]
    docs.forEach((doc) => {
      requests.push(doc);
      console.log(requests);
      res.send(requests);
    });
  }).catch((error) => {
    res.send({"error": error});
  });
});

exports.auth = functions.https.onRequest((req, res) => {
  const tokenId = req.get("Authorization").split("Bearer ")[1];

  return admin.auth().verifyIdToken(tokenId)
      .then((decoded) => res.status(200).send(decoded))
      .catch((err) => res.status(401).send(err));
});


// http callable
exports.sayHello = functions.https.onCall((data, context) => {
  const name = data.name;

  return `Hello, ${name}`;
});

exports.logActivities = functions.firestore.document("/{collection}/{id}")
    .onCreate( (snap, context) => {
      const coll = context.params.collection;
      // const id = context.params.id;
      const activities = admin.firestore().collection("activities");


      if (coll === "requests") {
        return activities.add({text: "a new tutorial was added to the requests collection"});
      }

      if (coll === "users") {
        return activities.add({text: "a new user was added to the database"});
      }

      return null;
    });

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
