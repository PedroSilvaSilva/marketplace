import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import { config } from '@config/index';
import prisma from '@config/database';
import { JWTPayload } from '@utils/crypto';

const jwtOptions: StrategyOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.jwt.secret,
  issuer: 'cswmarkets',
  audience: 'cswmarkets-api',
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload: JWTPayload, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          userType: true,
          status: true,
          isEmailVerified: true,
          mfaEnabled: true,
          profile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!user) {
        return done(null, false);
      }

      if (user.status !== 'ACTIVE') {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      return done(error, false);
    }
  })
);

export default passport;
