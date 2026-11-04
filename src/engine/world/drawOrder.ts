/**
 * Where the seabed and the open water come in the opaque draw order. Three draws the opaque meshes
 * by renderOrder first, then nearest first; everything else keeps the default 0. The seabed is one
 * mesh under everything (its centre sorts it in front of stone that covers it) and the water sky is
 * the whole background, so both go after the rest: the depth test then skips the fragments the
 * stone and Nox already cover instead of shading them and painting over them. The pixels are the
 * same (every other opaque writes depth; the sky writes none and is behind all of them); at tier
 * high this saved about 4 ms of GPU a frame on the Intel UHD, about 2 ms at low.
 */
export const SEABED_ORDER = 1;
/** After the seabed. */
export const WATER_SKY_ORDER = 2;
