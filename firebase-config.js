const firebaseConfig = {
  apiKey: "AIzaSyAxRMb_s2qg-goDpKb51GVDpfKNMR0Vrmg",
  authDomain: "bleh4k.firebaseapp.com",
  databaseURL: "https://bleh4k-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bleh4k",
  storageBucket: "bleh4k.firebasestorage.app",
  messagingSenderId: "461498995419",
  appId: "1:461498995419:web:f285778e529d66cdf372fe"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();