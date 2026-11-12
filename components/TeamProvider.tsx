"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type Team = {
  id: string;
  name: string;
  role: string;
};

type TeamContextValue = {
  teams: Team[];
  activeTeamId: string | null;
  activeTeam: Team | null;
  loading: boolean;
  error: string | null;
  setActiveTeamId: (teamId: string) => void;
  refreshTeams: () => Promise<void>;
};

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(null);

  const setActiveTeamId = useCallback((teamId: string) => {
    setActiveTeamIdState(teamId);
  }, []);

  const refreshTeams = useCallback(async () => {
    // Team workspaces are not enabled yet. Keep this as a no-op so core video
    // generation does not depend on team tables that may not exist.
  }, []);

  const value = useMemo<TeamContextValue>(
    () => ({
      teams: [],
      activeTeamId,
      activeTeam: null,
      loading: false,
      error: null,
      setActiveTeamId,
      refreshTeams,
    }),
    [activeTeamId, refreshTeams, setActiveTeamId]
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error("useTeam must be used inside TeamProvider.");
  }
  return context;
}
