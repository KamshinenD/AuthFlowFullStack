const sendEmail = require("./sendEmail");

const sendVerificationSuccessEmail = async ({
  name,
  email,
}) => {;
  const message = `<p>your email verification was succesful.</p> <p>Thanks for using our service</p>`;
  return sendEmail({
    to: email,
    subject: "Email Confirmation Successful",
    html: `<h4>Dear ${name}</h4> ${message}`,
  });
};

module.exports = sendVerificationSuccessEmail;
