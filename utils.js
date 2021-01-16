const axios = require("axios");
const instance = axios.create({
  baseURL: "https://api.tenor.com/v1/",
  timeout: 1000,
  params: {
    key: process.env.TENOR_API_KEY,
    locale: "en_US",
    contentfilter: "off",
    media_filter: "basic",
    ar_range: "all",
  },
});

module.exports = {
  getTenorGif: async query => {
    return instance
      .get("/random", {
        params: {
          q: query,
          limit: 1,
        },
      })
      .then(response => response.data.results[0].url);
  },
};
