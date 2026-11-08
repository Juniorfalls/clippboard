"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/utils/supabase/client";

export type Team = {
  id: string;
  name: string;
  role: string;
};

type TeamMembershipRow = {
  team_id: string;
  role: string;
  teams: { id: string; name: string } | { id: string; name: string }[] | null;
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

const STORAGE_KEY = "clippboard:active-team";
const TeamContext = createContext<TeamContextValue | null>(null);

function teamFromMembership(row: TeamMembershipRow): Team | null {
  const team = Array.isArray(row.teams) ? row.teams[0] : row.teams;
  if (!team) return null;
  return { id: team.id, name: team.name, role: row.role };
}

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTeams = useCallback(async () => {
    try {
      setError(null);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setTeams([]);
        setActiveTeamIdState(null);
        return;
      }

      const { error: ensureError } = await supabase.rpc(
        "ensure_personal_team",
        { team_name: "My workspace" }
      );
      if (ensureError) throw ensureError;

      const { data, error: membershipsError } = await supabase
        .from("team_members")
        .select("team_id, role, teams!inner(id, name)")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (membershipsError) throw membershipsError;

      const nextTeams = ((data ?? []) as TeamMembershipRow[])
        .map(teamFromMembership)
        .filter((team): team is Team => Boolean(team))
        .sort((a, b) => a.name.localeCompare(b.name));

      setTeams(nextTeams);

      const stored =
        typeof window !== "undefined"
          ? window.localStorage.getItem(STORAGE_KEY)
          : null;
      const selected =
        nextTeams.find((team) => team.id === stored) ?? nextTeams[0] ?? null;

      setActiveTeamIdState(selected?.id ?? null);
      if (selected) {
        window.localStorage.setItem(STORAGE_KEY, selected.id);
      }
    } catch (teamError) {
      setError(
        teamError instanceof Error
          ? teamError.message
          : "Could not load team workspaces."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTeams();
  }, [refreshTeams]);

  const setActiveTeamId = useCallback((teamId: string) => {
    setActiveTeamIdState(teamId);
    window.localStorage.setItem(STORAGE_KEY, teamId);
  }, []);

  const value = useMemo<TeamContextValue>(() => {
    const activeTeam =
      teams.find((team) => team.id === activeTeamId) ?? null;
    return {
      teams,
      activeTeamId,
      activeTeam,
      loading,
      error,
      setActiveTeamId,
      refreshTeams,
    };
  }, [activeTeamId, error, loading, refreshTeams, setActiveTeamId, teams]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error("useTeam must be used inside TeamProvider.");
  }
  return context;
}
