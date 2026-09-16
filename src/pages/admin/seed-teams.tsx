export const getServerSideProps = async () => ({
  redirect: { destination: "/admin/teams", permanent: false },
});
export default function SeedTeams() {
  return null;
}
