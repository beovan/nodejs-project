import userService from "../services/userService";

let handleLogin = async (req, res) => {
  try {
    let email = req.body.email;
    let password = req.body.password;
    let uid = req.body.uid;
    // let accessToken = req.body.accessToken;
    // console.log("uidsadf:", uid);
    // console.log("req:", req.body);
    if (!uid ) {
      // If neither uid nor accessToken is provided, it's not a Google login
      if (!email || !password) {
        return res.status(500).json({
          errCode: 1,
          errMessage: "empty email or password",
        });
      }
      let userData = await userService.handleUserLogin(email, password);
      //check email and password
      //compare password
      //return user
      //access_topken: JWT json web token
      return res.status(200).json({
        errCode: userData.errCode,
        errMessage: userData.errMessage,
        user: userData.user ? userData.user : {},
      });
    } else {
      // If either uid or accessToken is provided, it's a Google login
      let userData = await userService.handleGoogleLogin({
        uid: uid,
        email: email,
      });
      return res.status(200).json({
        errCode: userData.errCode,
        errMessage: userData.errMessage,
        user: userData.user ? userData.user : {},
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      errCode: -1,
      errMessage: "An error occurred",
    });
  }
};

let handleGetAllUsers = async (req, res) => {
  let id = req.query.id; //All ,SINGLE

  if (!id) {
    return res.status(200).json({
      errCode: 1,
      errMessage: "Missing required parameters",
      users: [],
    });
  }
  let users = await userService.getALLUsers(id);

  return res.status(200).json({
    errCode: 0,
    errMessage: "OK",
    users,
  });
};

let handleCreateNewUser = async (req, res) => {
  let message = await userService.createNewUser(req.body);
  return res.status(200).json(message);
};

let handleDeleteUser = async (req, res) => {
  if (!req.body.id) {
    return res.status(200).json({
      errCode: 1,
      errMessage: "Missing required parameters",
    });
  }
  let message = await userService.deleteUser(req.body.id);
  return res.status(200).json(message);
};

let handleEditUser = async (req, res) => {
  let data = req.body;
  let message = await userService.updateUserData(data);
  return res.status(200).json(message);
};

let getAllCode = async (req, res) => {
  try {
    let data = await userService.getAllCodeService(req.query.type);
    return res.status(200).json(data);
  } catch (e) {
    console.log("Get all code", e);
    return res.status(200).json({
      errCode: -1,
      errMessage: "Error from server",
    });
  }
};
module.exports = {
  handleLogin: handleLogin,
  handleGetAllUsers: handleGetAllUsers,
  handleCreateNewUser: handleCreateNewUser,
  handleEditUser: handleEditUser,
  handleDeleteUser: handleDeleteUser,
  getAllCode: getAllCode,
};
