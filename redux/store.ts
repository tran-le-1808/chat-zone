import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./features/authSlice";
import chatReducer from "./features/chatSlice";
import userReducer from "./features/userSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    users: userReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
