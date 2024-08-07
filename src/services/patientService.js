import db from "../models/index";
import emailservice from "./emailService";
require("dotenv").config();
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import userService from "./userService";
const jwt = require('jsonwebtoken');
const User = db.User;

let buildUrlEmail = (doctorId, token) => {
  let result = `${process.env.URL_REACT}/verify-booking?doctorId=${doctorId}&token=${token}`;
  return result;
};
let buildUrlEmailResetPassword = (userId, token) => {
  if (!process.env.URL_REACT) {
    console.error('URL_REACT environment variable is not set');
    return;
  }
  if (!userId) {
    console.error('userId is not defined');
    return;
  }
  if (!token) {
    console.error('token is not defined');
    return;
  }
  let result = `${process.env.URL_REACT}/reset-password?userId=${userId}&token=${token}`;
  return result;
};


const salt = bcrypt.genSaltSync(10);


let hashUserPassword = (password) => {
  return new Promise(async (resolve, reject) => {
    try {
      let hashPassword = await bcrypt.hashSync(password, salt);
      resolve(hashPassword);
    } catch (err) {
      reject(err);
    }
    resolve(true);
  });
};

let checkUserEmail = (userEmail) => {
  return new Promise(async (resolve, reject) => {
    try {
      let user = await db.User.findOne({
        where: { email: userEmail },
      });
      if (user) {
        resolve(true);
      } else {
        resolve(false);
      }
    } catch (e) {
      reject(e);
    }
  });
};

let postBookAppointment = (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (
        !data.email ||
        !data.doctorId ||
        !data.timeType ||
        !data.date ||
        !data.fullName ||
        !data.selectedGender ||
        !data.address
      ) {
        resolve({
          errCode: 1,
          errMessage: "Missing required parameter",
        });
      } else {
        let token = uuidv4();
        await emailservice.sendSimpleEmail({
          reciverEmail: data.email,
          patientName: data.fullName,
          time: data.timeString,
          doctorName: data.doctorName,
          language: data.language,
          redirectLink: buildUrlEmail(data.doctorId, token),
        });

        //upsert patient
        let user = await db.User.findOrCreate({
          where: { email: data.email },
          defaults: {
            email: data.email,
            roleId: "R3",
            gender: data.selectedGender,
            address: data.address,
            firstName: data.fullName
          },
        });

        //create a bookking record
        if (user && user[0]) {
          await db.Booking.findOrCreate({
            where: { patientId: user[0].id },
            defaults: {
              statusId: "S1",
              doctorId: data.doctorId,
              patientId: user[0].id,
              date: data.date,
              timeType: data.timeType,
              token: token,
            },
          });
        }
        resolve({
          errCode: 0,
          errMessage: "Save infor patient success",
        });
      }
    } catch (e) {
      reject(e);
    }
  });
};

let postVerifyBookAppointment = (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!data.token || !data.doctorId) {
        resolve({
          errCode: 1,
          errMessage: "Missing required parameter",
        });
      } else {
        let appointment = await db.Booking.findOne({
          where: {
            doctorId: data.doctorId,
            token: data.token,
            statusId: "S1",
          },
          raw: false,
        });

        if (appointment) {
          appointment.statusId = "S2";
          await appointment.save();

          resolve({
            errCode: 0,
            errMessage: "update the  appointment success",
          });
        } else {
          resolve({
            errCode: 2,
            errMessage: "Appointment has beend activated or does not exist",
          });
        }
      }
    } catch (e) {
      reject(e);
    }
  });
};


let createNewPatient = (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(data);
      if (!data.email ) {
        reject({
          errCode : 1,
          errMessage: 'Email is empty'
      });
    }
      let check = await checkUserEmail(data.email);
      if (check === true) {
        let islogin = await userService.handleGoogleLogin({
          uid: data.uid,
          email: data.email,
        }); 
        resolve({
          errCode: 1,
          errMessage: "Your email is already in used. Please try another email",
          loginResult: islogin
        });
      }
      else {
        let hashPasswordFromBcrypt = data.password ? await hashUserPassword(data.password) : null;
        let newUser =  await db.User.create({
          email: data.email,
          password: hashPasswordFromBcrypt,
          firstName: data.firstName,
          lastName: data.lastName,
          address: data.address,
          phonenumber: data.phonenumber,
          gender: data.gender,
          roleId: "R3",
          image: data.image,
          uid: data.uid,
          // accessToken: data.accessToken
        });
        if (newUser) {
          let userInfo = newUser.dataValues; // Access the created user data
          delete userInfo.password;
          delete userInfo.updatedAt;
          delete userInfo.createdAt;
          resolve({
            errCode: 0,
            errMessage: "OK",
            user: userInfo
          });
        }
        else{
          resolve({
            errCode: 0,
            errMessage: "OK",
          });
        }
     
      }

 
    } catch (e) {
      reject(e);
    }
  });
};
let forgotPassword = (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!data.email) {
        resolve({
          errCode: 1,
          errMessage: "Missing required parameter",
        });
      } else {
        let user = await db.User.findOne({
          where: { email: data.email },
        });
        if (user) {
          let accessToken = jwt.sign(
            { id: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // token will expire in 1 hour
          );
          await emailservice.sendForgotPasswordEmail({
            reciverEmail: data.email,
            accessToken: accessToken,
            firstName: user.firstName,
            resetUrl: buildUrlEmailResetPassword(user.id, accessToken)
          });
          await db.User.update({ accessToken: accessToken }, { where: { id: user.id } });
          resolve({
            errCode: 0,
            errMessage: "OK",
          });
        } else {
          resolve({
            errCode: 2,
            errMessage: "Email not found",
          });
        }
      }
    } catch (e) {
      reject(e);
    }
  });
};

let resetPassword = (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(data);
      let user = await db.User.findOne({
        where: { accessToken: data.accessToken },
      });
      if (!user) {
        resolve({
          errCode: 1,
          errMessage: "Invalid token",
        });
      } else if (user.resetPasswordExpires < Date.now()) {
        resolve({
          errCode: 2,
          errMessage: "Token has expired",
        });
      } else {
        if (!data.password) {
          resolve({
            errCode: 3,
            errMessage: "New password is required",
          });
          return;
        }
        let hashedPassword = await hashUserPassword(data.password);

        user.password = hashedPassword;
        user.accessToken = null;
        user.resetPasswordExpires = null;
        await db.User.update({ password: user.password }, { where: { id: user.id } });
        resolve({
          errCode: 0,
          errMessage: "Password has been reset",
        });
      }
    } catch (e) {
      reject(e);
    }
  });
};


let getBookingByUserId = async (user) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!user.userId) {
        resolve({
          errCode: 1,
          errMessage: "Missing required parametergfdsgfd",
        });
      } else {
        let data = await db.Booking.findOne({
          where: { patientId: user.userId }
        });
        resolve({
          errCode: 0,
          data: data,
        });
      }
    } catch (e) {
      reject(e);
    }
  });

}
module.exports = {
  postBookAppointment: postBookAppointment,
  postVerifyBookAppointment: postVerifyBookAppointment,
  createNewPatient: createNewPatient,
  forgotPassword: forgotPassword,
  resetPassword: resetPassword,
  getBookingByUserId: getBookingByUserId
};
