"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, {
  AddFrame,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card";

import { config } from "~/components/providers/WagmiProvider";
import { truncateAddress } from "~/lib/truncateAddress";
import { base, optimism } from "wagmi/chains";
import { useSession } from "next-auth/react";
import { createStore } from "mipd";
import { Label } from "~/components/ui/label";
import { PROJECT_TITLE, COUNTDOWN_MESSAGES } from "~/lib/constants";

function CountdownCard() {
  const [timeLeft, setTimeLeft] = useState<string>("Loading...");
  const [message, setMessage] = useState(COUNTDOWN_MESSAGES.UPCOMING);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const day = now.getUTCDay();
      const hour = now.getUTCHours();
      
      // Get next Friday at 17:00 UTC
      let daysUntilFriday = (5 - day + 7) % 7;
      if (day === 5 && hour >= FRIDAY_EVENT_TIME) {
        daysUntilFriday = 7; // If past Friday 5pm, show next week
      }
      
      const nextFriday = new Date(now);
      nextFriday.setUTCDate(now.getUTCDate() + daysUntilFriday);
      nextFriday.setUTCHours(FRIDAY_EVENT_TIME, 0, 0, 0);

      const diff = nextFriday.getTime() - now.getTime();
      
      if (diff < 0) {
        setMessage(COUNTDOWN_MESSAGES.ON_TIME);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${days}d ${hours}h ${minutes}m ${seconds}s`
      );
      setMessage(days === 0 && hours === 0 ? COUNTDOWN_MESSAGES.ON_TIME : COUNTDOWN_MESSAGES.UPCOMING);
    };

    // Update every second
    const interval = setInterval(calculateTime, 1000);
    calculateTime(); // Initial call
    
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Friday Countdown</CardTitle>
        <CardDescription>
          {message}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <div className="text-4xl font-bold mb-4">
          {timeLeft}
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>Days</span>
          <span>Hours</span>
          <span>Minutes</span>
          <span>Seconds</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Frame() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();

  const [added, setAdded] = useState(false);

  const [addFrameResult, setAddFrameResult] = useState("");

  const addFrame = useCallback(async () => {
    try {
      await sdk.actions.addFrame();
    } catch (error) {
      if (error instanceof AddFrame.RejectedByUser) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      if (error instanceof AddFrame.InvalidDomainManifest) {
        setAddFrameResult(`Not added: ${error.message}`);
      }

      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      if (!context) {
        return;
      }

      setContext(context);
      setAdded(context.client.added);

      // If frame isn't already added, prompt user to add it
      if (!context.client.added) {
        addFrame();
      }

      sdk.on("frameAdded", ({ notificationDetails }) => {
        setAdded(true);
      });

      sdk.on("frameAddRejected", ({ reason }) => {
        console.log("frameAddRejected", reason);
      });

      sdk.on("frameRemoved", () => {
        console.log("frameRemoved");
        setAdded(false);
      });

      sdk.on("notificationsEnabled", ({ notificationDetails }) => {
        console.log("notificationsEnabled", notificationDetails);
      });
      sdk.on("notificationsDisabled", () => {
        console.log("notificationsDisabled");
      });

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });

      console.log("Calling ready");
      sdk.actions.ready({});

      // Set up a MIPD Store, and request Providers.
      const store = createStore();

      // Subscribe to the MIPD Store.
      store.subscribe((providerDetails) => {
        console.log("PROVIDER DETAILS", providerDetails);
        // => [EIP6963ProviderDetail, EIP6963ProviderDetail, ...]
      });
    };
    if (sdk && !isSDKLoaded) {
      console.log("Calling load");
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded, addFrame]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      <div className="w-[300px] mx-auto py-2 px-2">
        <h1 className="text-2xl font-bold text-center mb-4 text-gray-700 dark:text-gray-300">
          {PROJECT_TITLE}
        </h1>
        <CountdownCard />
      </div>
    </div>
  );
}
