var app = new Vue({
    el: '#app',
    data: {
        requests: [],
    },

    mounted() {

        const ref = firebase.firestore().collection('requests').orderBy('upvote', "desc");

        ref.onSnapshot(snapshot => {
            let requests = [];

            snapshot.forEach(doc => {
                requests.push({...doc.data(), id: doc.id});
            });

            this.requests = requests;
        });
    },

    methods: {
        upvoteRequest(id) {
            const upvote = firebase.functions().httpsCallable("upvote");
            upvote({id: id}).catch(error => {                              // what happened to the context property?
                console.log(error.message);
            })
        }
    }
});
  
  