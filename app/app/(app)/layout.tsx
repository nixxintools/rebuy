import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import AppNav from "@/components/AppNav";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f9fafb" }}>
      <AppNav email={user.email} />
      <Container maxWidth="md" component="main" sx={{ py: { xs: 4, md: 6 } }}>
        {children}
      </Container>
    </Box>
  );
}
