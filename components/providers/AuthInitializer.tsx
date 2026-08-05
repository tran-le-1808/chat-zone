"use client";

import { useEffect } from "react";

import { getProfile } from "@/redux/features/authSlice";

import { useAppDispatch } from "@/redux/hooks";
import { socket } from "@/lib/socket";
import {
  addOnlineUser,
  removeOnlineUser,
  setOnlineUsers,
} from "@/redux/features/userSlice";

export default function AuthInitializer() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(getProfile());
  }, [dispatch]);

  useEffect(() => {
    socket.on("onlineUsers", (users: string[]) => {
      dispatch(setOnlineUsers(users));
    });

    socket.on("userOnline", (userId: string) => {
      dispatch(addOnlineUser(userId));
    });

    socket.on("userOffline", (userId: string) => {
      dispatch(removeOnlineUser(userId));
    });

    return () => {
      socket.off("onlineUsers");

      socket.off("userOnline");

      socket.off("userOffline");
    };
  }, [dispatch]);

  return null;
}
