import React, { useState, useContext, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";

// Material-UI Components
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import InputAdornment from "@material-ui/core/InputAdornment";
import IconButton from "@material-ui/core/IconButton";
import Visibility from "@material-ui/icons/Visibility";
import VisibilityOff from "@material-ui/icons/VisibilityOff";
import CircularProgress from "@material-ui/core/CircularProgress";
import useMediaQuery from "@material-ui/core/useMediaQuery";

// Custom Imports
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  "@keyframes floatDots": {
    "0%": { transform: "translate(0, 0)" },
    "100%": { transform: "translate(50px, 50px)" }
  },
  "@keyframes fadeInUp": {
    "0%": { opacity: 0, transform: "translateY(20px)" },
    "100%": { opacity: 1, transform: "translateY(0)" }
  },
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: theme.palette.type === "dark"
      ? "linear-gradient(135deg, #121212 0%, #1e1e1e 100%)"
      : "linear-gradient(135deg, #0066cc 0%, #0099ff 100%)",
    position: "relative",
    overflow: "hidden"
  },
  bgPattern: {
    position: "absolute",
    top: "-50%",
    left: "-50%",
    width: "200%",
    height: "200%",
    background: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    animation: "$floatDots 20s infinite linear",
    zIndex: 0,
    pointerEvents: "none"
  },
  decorativeCircle1: {
    position: "absolute",
    width: 300,
    height: 300,
    top: -150,
    left: -150,
    borderRadius: "50%",
    background: theme.palette.type === "dark"
      ? "rgba(255,255,255,0.03)"
      : "rgba(255,255,255,0.08)",
    zIndex: 0,
    pointerEvents: "none"
  },
  decorativeCircle2: {
    position: "absolute",
    width: 200,
    height: 200,
    bottom: -100,
    right: -100,
    borderRadius: "50%",
    background: theme.palette.type === "dark"
      ? "rgba(255,255,255,0.03)"
      : "rgba(255,255,255,0.08)",
    zIndex: 0,
    pointerEvents: "none"
  },
  decorativeCircle3: {
    position: "absolute",
    width: 150,
    height: 150,
    top: "20%",
    right: "10%",
    borderRadius: "50%",
    background: theme.palette.type === "dark"
      ? "rgba(255,255,255,0.02)"
      : "rgba(255,255,255,0.06)",
    zIndex: 0,
    pointerEvents: "none"
  },
  loginContainer: {
    position: "relative",
    width: "100%",
    maxWidth: 420,
    margin: theme.spacing(2),
    zIndex: 1,
    animation: "$fadeInUp 0.6s ease-out"
  },
  loginCard: {
    padding: theme.spacing(3, 3, 3),
    paddingTop: 30,
    borderRadius: 16,
    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    background: theme.palette.background.paper,
    textAlign: "center",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    "&:hover": {
      transform: "translateY(-3px)",
      boxShadow: "0 12px 40px rgba(0,0,0,0.2)"
    }
  },
  logoImage: {
    width: 300,
    height: "auto",
    maxHeight: 180,
    objectFit: "contain",
    display: "block",
    margin: "16px auto 8px"
  },
  welcomeText: {
    color: theme.palette.text.secondary,
    fontSize: "1.15rem",
    fontWeight: 400,
    marginBottom: 0
  },
  systemTitle: {
    fontWeight: 700,
    fontSize: "1.75rem",
    background: "linear-gradient(135deg, #0066cc, #0099ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: theme.spacing(1)
  },
  formTitle: {
    margin: theme.spacing(0, 0, 1),
    color: theme.palette.text.primary,
    fontWeight: 600,
    fontSize: "1.25rem"
  },
  form: {
    width: "100%",
    marginTop: theme.spacing(0)
  },
  inputField: {
    marginBottom: theme.spacing(1),
    "& .MuiOutlinedInput-root": {
      borderRadius: 8,
      backgroundColor: theme.palette.background.default,
      "& fieldset": {
        borderColor: theme.palette.divider
      },
      "&:hover fieldset": {
        borderColor: theme.palette.primary.light
      },
      "&.Mui-focused fieldset": {
        borderColor: theme.palette.primary.main,
        boxShadow: "0 0 0 2px " + theme.palette.primary.light
      }
    },
    "& .MuiInputLabel-root": {
      color: theme.palette.text.secondary,
      "&.Mui-focused": {
        color: theme.palette.primary.main
      }
    }
  },
  submitButton: {
    margin: theme.spacing(2, 0, 1),
    padding: theme.spacing(1.5),
    borderRadius: 8,
    fontWeight: 600,
    fontSize: "1rem",
    letterSpacing: 0.5,
    textTransform: "none",
    boxShadow: "none",
    transition: "all 0.2s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: theme.shadows[4]
    },
    "&:active": {
      transform: "translateY(0)"
    }
  },
  linkText: {
    color: theme.palette.text.secondary,
    fontWeight: 500,
    textDecoration: "none",
    display: "inline-block",
    margin: theme.spacing(1, 0),
    transition: "color 0.2s ease",
    "&:hover": {
      color: theme.palette.primary.main
    }
  }
}));

const Login = () => {
    const theme = useTheme();
    const classes = useStyles();
    const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
    const [user, setUser] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const { handleLogin, loading } = useContext(AuthContext);
    const [viewregister, setviewregister] = useState("disabled");

    const handleChangeInput = (e) => {
        setUser({ ...user, [e.target.name]: e.target.value });
    };

    const handleClickShowPassword = () => {
        setShowPassword(!showPassword);
    };

    useEffect(() => {
        fetchviewregister();
    }, []);

    const fetchviewregister = async () => {
        try {
            const responsev = await api.get("/settings/viewregister");
            const viewregisterX = responsev?.data?.value;
            setviewregister(viewregisterX);
        } catch (error) {
            console.error("Error retrieving viewregister", error);
        }
    };

    const handlSubmit = (e) => {
        e.preventDefault();
        handleLogin(user);
    };

    const logo = `${process.env.REACT_APP_BACKEND_URL}/public/logotipos/login.png`;
    const randomValue = Math.random();
    const logoWithRandom = `${logo}?r=${randomValue}`;

    return (
        <div className={classes.root}>
            <div className={classes.bgPattern} />
            <div className={classes.decorativeCircle1} />
            <div className={classes.decorativeCircle2} />
            <div className={classes.decorativeCircle3} />

            <div className={classes.loginContainer}>
                <div className={classes.loginCard}>
                    <img
                        src={logoWithRandom}
                        alt="Logo"
                        className={classes.logoImage}
                    />

                    <Typography className={classes.welcomeText}>
                        Bem-vindo a
                    </Typography>
                    <Typography className={classes.systemTitle}>
                        FENIX SISTEMAS
                    </Typography>

                    <Typography className={classes.formTitle}>
                        Acesse sua conta
                    </Typography>

                    <form className={classes.form} onSubmit={handlSubmit}>
                        <TextField
                            variant="outlined"
                            margin="normal"
                            required
                            fullWidth
                            id="email"
                            label={i18n.t("login.form.email")}
                            name="email"
                            value={user.email}
                            onChange={handleChangeInput}
                            autoComplete="email"
                            className={classes.inputField}
                            placeholder="seu@email.com"
                        />

                        <TextField
                            variant="outlined"
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label={i18n.t("login.form.password")}
                            type={showPassword ? "text" : "password"}
                            id="password"
                            value={user.password}
                            onChange={handleChangeInput}
                            autoComplete="current-password"
                            className={classes.inputField}
                            placeholder="••••••••"
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            aria-label="toggle password visibility"
                                            onClick={handleClickShowPassword}
                                            edge="end"
                                            color={theme.palette.type === "dark" ? "default" : "primary"}
                                        >
                                            {showPassword ? <Visibility /> : <VisibilityOff />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            color="primary"
                            className={classes.submitButton}
                            disabled={loading}
                        >
                            {loading ? (
                                <CircularProgress size={24} color="inherit" />
                            ) : (
                                i18n.t("login.buttons.submit")
                            )}
                        </Button>

                        <Grid container justifyContent="space-between">
                            <Grid item>
                                {viewregister === "enabled" && (
                                    <Link
                                        component={RouterLink}
                                        to="/signup"
                                        className={classes.linkText}
                                    >
                                        Criar conta
                                    </Link>
                                )}
                            </Grid>
                            <Grid item>
                                <Link
                                    component={RouterLink}
                                    to="/forgetpsw"
                                    className={classes.linkText}
                                >
                                    Esqueceu a senha?
                                </Link>
                            </Grid>
                        </Grid>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
