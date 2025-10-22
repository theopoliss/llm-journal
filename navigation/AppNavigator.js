import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import HomeScreen from '../screens/HomeScreen';
import JournalListScreen from '../screens/JournalListScreen';
import EntryDetailScreen from '../screens/EntryDetailScreen';
import FolderDetailScreen from '../screens/FolderDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SearchScreen from '../screens/SearchScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#F2F2F7' },
          gestureEnabled: true,
          cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
          transitionSpec: {
            open: {
              animation: 'timing',
              config: {
                duration: 250,
              },
            },
            close: {
              animation: 'timing',
              config: {
                duration: 200,
              },
            },
          },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="JournalList" component={JournalListScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="FolderDetail" component={FolderDetailScreen} />
        <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
