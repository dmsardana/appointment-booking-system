const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const PORT = process.env.PORT || 5000;

mongoose.connect('your-mongodb-connection-string', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
    email: String,
    otp: String,
    otpVerified: { type: Boolean, default: false }
});

const slotSchema = new mongoose.Schema({
    time: String,
    isBooked: { type: Boolean, default: false },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
});

const User = mongoose.model('User', userSchema);
const Slot = mongoose.model('Slot', slotSchema);

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-email-password'
    }
});

app.post('/send-otp', (req, res) => {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    transporter.sendMail({
        from: 'your-email@gmail.com',
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}`
    }, async (error, info) => {
        if (error) {
            return res.status(500).json({ message: 'Error sending email' });
        }

        let user = await User.findOne({ email });
        if (!user) {
            user = new User({ email, otp });
        } else {
            user.otp = otp;
        }

        await user.save();
        res.json({ message: 'OTP sent successfully' });
    });
});

app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    const user = await User.findOne({ email, otp });

    if (!user) {
        return res.status(400).json({ message: 'Invalid OTP' });
    }

    user.otpVerified = true;
    await user.save();
    res.json({ message: 'OTP verified successfully' });
});

app.get('/slots', async (req, res) => {
    const slots = await Slot.find().populate('bookedBy', 'email');
    res.json(slots);
});

app.post('/book', async (req, res) => {
    const { slotId, email } = req.body;
    const user = await User.findOne({ email, otpVerified: true });

    if (!user) {
        return res.status(400).json({ message: 'User not authenticated' });
    }

    const slot = await Slot.findById(slotId);
    if (slot.isBooked) {
        return res.status(400).json({ message: 'Slot is already booked' });
    }

    slot.isBooked = true;
    slot.bookedBy = user._id;
    await slot.save();

    res.json({ message: 'Slot booked successfully' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});