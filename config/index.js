const mongo = {
  URL:
    "mongodb+srv://NodeServerAdmin:9jFcbSW56QzzgnMU@nodeservercluster-edoax.gcp.mongodb.net/node-server-1?retryWrites=true"
};

const server = {
  PROTOCOL: 'http',
  URL: 'localhost',
  PORT: 3001,
}

module.exports = {
  mongo,
  server,
}
