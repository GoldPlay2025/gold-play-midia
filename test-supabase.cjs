require('dotenv').config();
const { useSupabaseAuthState } = require('./dist/server.cjs'); // wait, can't easily do this if it's not exported nicely
