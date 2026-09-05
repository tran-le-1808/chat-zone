import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./features/authSlice";
import chatReducer from "./features/chatSlice";
import userReducer from "./features/userSlice";
import aiReducer from "./features/aiSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    users: userReducer,
    ai: aiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
