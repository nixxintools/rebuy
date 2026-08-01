import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

export default function Section({
  id,
  eyebrow,
  title,
  subtitle,
  tinted,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  tinted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box
      id={id}
      component="section"
      sx={{ py: { xs: 8, md: 12 }, bgcolor: tinted ? "#f9fafb" : "transparent", scrollMarginTop: 72 }}
    >
      <Container maxWidth="lg">
        {(eyebrow || title || subtitle) && (
          <Box sx={{ textAlign: "center", maxWidth: 720, mx: "auto", mb: { xs: 5, md: 7 } }}>
            {eyebrow && (
              <Typography
                variant="overline"
                sx={{ color: "primary.main", fontWeight: 700, letterSpacing: "0.08em" }}
              >
                {eyebrow}
              </Typography>
            )}
            {title && (
              <Typography variant="h2" sx={{ mt: 1 }}>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2, fontSize: "1.075rem" }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        )}
        {children}
      </Container>
    </Box>
  );
}
