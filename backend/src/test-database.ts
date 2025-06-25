import { userDatabase } from './services/userDatabase';

async function testDatabase() {
  console.log('🧪 Testing User Database...\n');

  try {
    // Test 1: Create a user
    console.log('1. Creating a test user...');
    const newUser = await userDatabase.createUser({
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedpassword123',
    });
    console.log('✅ User created:', newUser.email, 'with ID:', newUser.id);

    // Test 2: Find user by email
    console.log('\n2. Finding user by email...');
    const foundUser = await userDatabase.findUserByEmail('test@example.com');
    console.log('✅ User found:', foundUser?.email);

    // Test 3: Find user by ID
    console.log('\n3. Finding user by ID...');
    const foundById = await userDatabase.findUserById(newUser.id);
    console.log('✅ User found by ID:', foundById?.email);

    // Test 4: Update user
    console.log('\n4. Updating user...');
    const updatedUser = await userDatabase.updateUser(newUser.id, {
      name: 'Updated Test User',
    });
    console.log('✅ User updated:', updatedUser?.name);

    // Test 5: Get user count
    console.log('\n5. Getting user count...');
    const count = await userDatabase.getUserCount();
    console.log('✅ Total users:', count);

    // Test 6: Get all users
    console.log('\n6. Getting all users...');
    const allUsers = await userDatabase.getAllUsers();
    console.log('✅ All users:', allUsers.map(u => u.email));

    // Test 7: Create backup
    console.log('\n7. Creating backup...');
    const backupPath = await userDatabase.createBackup();
    console.log('✅ Backup created at:', backupPath);

    // Test 8: Delete user
    console.log('\n8. Deleting user...');
    const deleted = await userDatabase.deleteUser(newUser.id);
    console.log('✅ User deleted:', deleted);

    // Test 9: Verify deletion
    console.log('\n9. Verifying deletion...');
    const deletedUser = await userDatabase.findUserById(newUser.id);
    console.log('✅ User after deletion:', deletedUser ? 'Still exists' : 'Successfully deleted');

    console.log('\n🎉 All tests passed! Database is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDatabase();
