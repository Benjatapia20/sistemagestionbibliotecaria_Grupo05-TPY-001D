exports.handler = async () => {
  return {
    statusCode: 302,
    headers: {
      Location: "/mis-pedidos?tab=multas#pago=verificado",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  }
}
