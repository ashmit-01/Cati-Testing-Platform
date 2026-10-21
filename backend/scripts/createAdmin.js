import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

/**
 * Creates the dashboard login user (there is no sign-up page).
 *
 *   npm run create-admin            create it if it doesn't exist
 *   npm run create-admin -- --reset also reset the password if it exists
 *
 * Reads ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_NAME from backend/.env.
 */
const email = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || '';
const name = process.env.ADMIN_NAME || 'Admin';
const reset = process.argv.includes('--reset');

if (!process.env.MONGO_URI || !email || !password) {
    console.error('Set MONGO_URI, ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env first.');
    process.exit(1);
}

try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });

    const existing = await User.findOne({ email });
    const hash = await bcrypt.hash(password, 10);

    if (!existing) {
        await User.create({ name, email, password: hash, isActive: true });
        console.log(`Created login user ${email}`);
    } else if (reset) {
        existing.password = hash;
        existing.isActive = true;
        await existing.save();
        console.log(`Reset password for ${email}`);
    } else {
        console.log(`User ${email} already exists (use --reset to change its password).`);
    }
} catch (err) {
    console.error('Could not create the user:', err.message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect().catch(() => {});
}
