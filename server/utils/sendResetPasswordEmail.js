const sendEmail = require("./sendEmail");

const sendResetPasswordEmail=async({name, email, token, origin})=>{
    const resetURL=`${origin}/user/reset-password?token=${token}&email=${email}`
    const mesage=`<p>Please reset password by clicking on the following link: <a href="${resetURL}">Reset Password</a></p><p>Please note that this is valid for only 10 minutes only</p>`;

    return sendEmail({
        to:email,
        subject:"Reset Password",
        html:`<h4>Hello, ${name}</h4>
        ${mesage}
        `
    })
};


module.exports= sendResetPasswordEmail;