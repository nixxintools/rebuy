"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { GRADIENT } from "@/lib/theme";

type Address = {
  name: string;
  street: string;
  locality: string | null;
  region: string | null;
  postalCode: string | null;
  country: string;
};

const EMPTY = { name: "", street: "", locality: "", region: "", postalCode: "", country: "US" };

export default function ShippingAddress() {
  const [address, setAddress] = useState<Address | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/shipping");
      if (r.ok) setAddress((await r.json()).address);
    } catch {
      // One card failing shouldn't take the dashboard with it.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!loaded) return null;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Couldn't save that address.");
      setAddress(j.address);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof EMPTY, label: string) => (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
    />
  );

  return (
    <Card>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 2 }}>
          <Avatar sx={{ background: GRADIENT, width: 44, height: 44 }}>
            <LocalShippingOutlinedIcon />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Where should replacements go?
            </Typography>
            <Typography variant="body2" color="text.secondary">
              A shop won&apos;t take an order without somewhere to send it. Without this, the agent
              can reserve the money but the cart can never be finished.
            </Typography>
          </Box>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {address && !editing ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: "center" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 500 }}>{address.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {[address.street, address.locality, address.region, address.postalCode, address.country]
                  .filter(Boolean)
                  .join(", ")}
              </Typography>
            </Box>
            <Button
              onClick={() => {
                setForm({
                  name: address.name,
                  street: address.street,
                  locality: address.locality ?? "",
                  region: address.region ?? "",
                  postalCode: address.postalCode ?? "",
                  country: address.country,
                });
                setEditing(true);
              }}
              variant="outlined"
            >
              Change
            </Button>
          </Stack>
        ) : (
          <Grid container spacing={2}>
            <Grid size={12}>{field("name", "Full name")}</Grid>
            <Grid size={12}>{field("street", "Street address")}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field("locality", "Town or city")}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field("region", "State or region")}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field("postalCode", "ZIP or postal code")}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field("country", "Country code (US)")}</Grid>
            <Grid size={12}>
              <Stack direction="row" spacing={1.5}>
                <Button
                  onClick={save}
                  disabled={busy}
                  variant="contained"
                  sx={{ background: GRADIENT }}
                >
                  Save address
                </Button>
                {address && (
                  <Button onClick={() => setEditing(false)} disabled={busy} color="inherit">
                    Cancel
                  </Button>
                )}
              </Stack>
            </Grid>
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}
