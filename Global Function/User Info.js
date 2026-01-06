function userInfo() {
  return JSON.stringify({
    hostName: system.machineName,
    userName: system.userName,
    aeVersion: app.buildName
  })
}
