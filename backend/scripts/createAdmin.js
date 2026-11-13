
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

async function createAdmin() {
    const {
        MONGO_URI,
        JWT_SECRET,
        ADMIN_EMAIL,
        ADMIN_PASSWORD,
        ADMIN_NAME
    } = process.env;

    // Validate environment configuration
    if (!MONGO_URI) {
        throw new Error('MONGO_URI is missing in backend/.env');
    }

    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET is missing in backend/.env');
    }

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        throw new Error(
            'ADMIN_EMAIL or ADMIN_PASSWORD is missing in backend/.env'
        );
    }

    if (ADMIN_PASSWORD.length < 8) {
        throw new Error('Admin password must contain at least 8 characters');
    }

    const email = ADMIN_EMAIL.trim().toLowerCase();
    const name = ADMIN_NAME?.trim() || 'Admin';

    try {
        console.log('Connecting to MongoDB...');

        await mongoose.connect(MONGO_URI);

        console.log('MongoDB connected successfully.');

        // Always hash the password before saving it.
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

        // Check whether this admin already exists.
        let user = await User.findOne({ email });

        if (user) {
            // Update the existing admin account.
            user.name = name;
            user.password = hashedPassword;
            user.isActive = true;

            await user.save();

            console.log('Existing admin account updated successfully.');
        } else {
            // Create a new admin account.
            await User.create({
                name,
                email,
                password: hashedPassword,
                isActive: true
            });

            console.log('New admin account created successfully.');
        }

        console.log(`Admin email: ${email}`);
        console.log('You can now log in to the CATI QA dashboard.');

    } finally {
        await mongoose.disconnect();
    }
}

createAdmin().catch((error) => {
    console.error('Admin creation failed:', error.message);
    process.exitCode = 1;
});
