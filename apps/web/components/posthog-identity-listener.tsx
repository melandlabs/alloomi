"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

import {
  getPosthogClient,
  initPosthog,
  isPosthogEnabled,
} from "@/lib/analytics/posthog/posthog";

type SurveyProfile = {
  role?: string | null;
  roles?: string[] | undefined;
  industry?: string | null;
  companySize?: string | null;
  dailyMessages?: string | null;
  communicationTools?: string[] | undefined;
  challenges?: string[] | undefined;
  surveyUpdatedAt?: string | null;
};

function serializeProfile(profile: SurveyProfile | null | undefined) {
  if (!profile) {
    return "";
  }

  return JSON.stringify({
    role: profile.role ?? null,
    roles: profile.roles ?? null,
    industry: profile.industry ?? null,
    companySize: profile.companySize ?? null,
    dailyMessages: profile.dailyMessages ?? null,
    communicationTools: profile.communicationTools ?? null,
    challenges: profile.challenges ?? null,
    surveyUpdatedAt: profile.surveyUpdatedAt ?? null,
  });
}

export function PosthogIdentityListener() {
  const { data: session, status } = useSession();
  const lastSignatureRef = useRef<string>("");
  const lastUserIdRef = useRef<string>("");

  useEffect(() => {
    initPosthog();

    if (!isPosthogEnabled()) {
      return;
    }

    const posthog = getPosthogClient();
    if (!posthog) {
      return;
    }

    if (status === "authenticated" && session?.user?.id) {
      const profile: SurveyProfile = {
        role: session.user.role,
        roles: session.user.roles,
        industry: session.user.industry,
        companySize: session.user.companySize,
        dailyMessages: session.user.dailyMessages,
        communicationTools: session.user.communicationTools,
        challenges: session.user.challenges,
        surveyUpdatedAt: session.user.surveyUpdatedAt,
      };
      const signature = serializeProfile(profile);
      const hasUserChanged = lastUserIdRef.current !== session.user.id;
      const hasProfileChanged = lastSignatureRef.current !== signature;

      if (hasUserChanged || hasProfileChanged) {
        posthog.identify(session.user.id, {
          email: session.user.email ?? undefined,
          alloomi_role: profile.role ?? undefined,
          alloomi_roles: profile.roles ?? undefined,
          alloomi_industry: profile.industry ?? undefined,
          alloomi_company_size: profile.companySize ?? undefined,
          alloomi_daily_messages: profile.dailyMessages ?? undefined,
          alloomi_tools: profile.communicationTools ?? undefined,
          alloomi_challenges: profile.challenges ?? undefined,
          alloomi_survey_updated_at: profile.surveyUpdatedAt ?? undefined,
        });

        posthog.register({
          alloomi_role: profile.role ?? undefined,
          alloomi_roles: profile.roles ?? undefined,
          alloomi_industry: profile.industry ?? undefined,
          alloomi_company_size: profile.companySize ?? undefined,
        });

        lastSignatureRef.current = signature;
        lastUserIdRef.current = session.user.id;
      }
    } else if (status === "unauthenticated") {
      if (lastUserIdRef.current !== "") {
        posthog.reset();
        lastUserIdRef.current = "";
        lastSignatureRef.current = "";
      }
    }
  }, [session, status]);

  return null;
}
